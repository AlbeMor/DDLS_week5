"""Minimal FastAPI application for the DDLS Week 5 project."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import numpy as np
import scanpy as sc
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "pbmc3k.h5ad"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load AnnData once when the application starts."""
    if not DATASET_PATH.is_file():
        raise FileNotFoundError(f"AnnData dataset not found: {DATASET_PATH}")

    print(f"Loading AnnData dataset: {DATASET_PATH}")
    try:
        app.state.adata = sc.read_h5ad(DATASET_PATH)
    except Exception as exc:
        raise RuntimeError(f"Failed to load AnnData dataset: {DATASET_PATH}") from exc

    yield


app = FastAPI(title="DDLS Week 5 Single-Cell Navigator", lifespan=lifespan)
TEMPLATE_PATH = Path(__file__).parent / "templates" / "index.html"
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.get("/", response_class=HTMLResponse)
def root() -> FileResponse:
    return FileResponse(TEMPLATE_PATH)


@app.get("/api/health")
def health(request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    return {
        "status": "ok",
        "dataset_loaded": True,
        "n_cells": adata.n_obs,
        "n_genes": adata.n_vars,
    }


@app.get("/api/gene/{gene_name}")
def gene_expression(gene_name: str, request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    matches = np.flatnonzero(np.asarray(adata.var_names == gene_name))
    if len(matches) == 0:
        raise HTTPException(status_code=404, detail=f"Gene '{gene_name}' not found")
    if len(matches) > 1:
        raise HTTPException(status_code=409, detail=f"Gene '{gene_name}' has duplicate names")

    expression = adata.X[:, int(matches[0])]
    if hasattr(expression, "toarray"):
        values = expression.toarray().ravel()
    else:
        values = np.asarray(expression).ravel()
    if values.size != adata.n_obs:
        raise HTTPException(status_code=503, detail="Gene expression length does not match the number of cells")

    return {
        "gene": str(adata.var_names[int(matches[0])]),
        "n_cells": adata.n_obs,
        "expression": [float(value) for value in values],
    }


@app.get("/api/umap")
def umap(request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    if "X_umap" not in adata.obsm:
        raise HTTPException(status_code=503, detail="UMAP coordinates are unavailable")

    coordinates = adata.obsm["X_umap"]
    if coordinates.ndim != 2 or coordinates.shape[1] < 2:
        raise HTTPException(status_code=503, detail="UMAP coordinates must have at least two columns")
    if coordinates.shape[0] != adata.n_obs:
        raise HTTPException(status_code=503, detail="UMAP row count does not match the number of cells")

    return {
        "n_cells": adata.n_obs,
        "coordinates": [
            {"x": float(row[0]), "y": float(row[1])}
            for row in coordinates
        ],
    }

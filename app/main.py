"""Minimal FastAPI application for the DDLS Week 5 project."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import scanpy as sc
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

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


@app.get("/", response_class=PlainTextResponse)
def root() -> str:
    return "DDLS Week 5 single-cell navigator"


@app.get("/api/health")
def health(request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    return {
        "status": "ok",
        "dataset_loaded": True,
        "n_cells": adata.n_obs,
        "n_genes": adata.n_vars,
    }

"""Minimal FastAPI application for the DDLS Week 5 project."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import numpy as np
import scipy.sparse as sparse
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


@app.get("/api/genes")
def genes(request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    names = [str(name) for name in adata.var_names]
    if len(names) != adata.n_vars:
        raise HTTPException(status_code=503, detail="Gene list length does not match the number of genes")
    return {"n_genes": adata.n_vars, "genes": names}


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


def _marker_summary(adata, mask: np.ndarray, top_n: int, direction: str) -> list[dict[str, float | int | str]]:
    expression = adata.X
    other_mask = ~mask
    n_other = int(other_mask.sum())
    cluster_values = expression[mask]
    other_values = expression[other_mask]
    cluster_mean = np.asarray(cluster_values.mean(axis=0)).ravel()
    other_mean = np.asarray(other_values.mean(axis=0)).ravel()
    cluster_n = np.asarray((cluster_values > 0).sum(axis=0)).ravel()
    other_n = np.asarray((other_values > 0).sum(axis=0)).ravel()
    cluster_fraction = cluster_n / int(mask.sum())
    other_fraction = other_n / n_other
    difference = cluster_mean - other_mean
    # Safe log fold change for log-normalized values: log2((mean + eps) / (other mean + eps)).
    eps = 1e-9
    log_fold_change = np.log2((cluster_mean + eps) / (other_mean + eps))
    if direction == "enriched":
        eligible = difference > 0
        # Positive difference first, then positive logFC, then consistency.
        order = np.lexsort((-cluster_fraction, -log_fold_change, -difference))
    else:
        eligible = difference < 0
        order = np.lexsort((-other_fraction, log_fold_change, difference))
    selected = [index for index in order if eligible[index]][:top_n]
    return [
        {
            "gene": str(adata.var_names[index]),
            "mean_cluster": float(cluster_mean[index]),
            "mean_other": float(other_mean[index]),
            "fraction_cluster": float(cluster_fraction[index]),
            "fraction_other": float(other_fraction[index]),
            "n_expressing_cluster": int(cluster_n[index]),
            "n_expressing_other": int(other_n[index]),
            "difference": float(difference[index]),
            "log_fold_change": float(log_fold_change[index]),
        }
        for index in selected
        if np.isfinite(cluster_mean[index]) and np.isfinite(other_mean[index]) and np.isfinite(log_fold_change[index])
    ]


@app.get("/api/cluster/{cluster_id}")
def cluster_detail(cluster_id: str, request: Request, top_n: int = 50) -> dict[str, object]:
    adata = request.app.state.adata
    if top_n < 1 or top_n > 200:
        raise HTTPException(status_code=400, detail="top_n must be between 1 and 200")
    required = ("leiden", "n_genes", "total_counts", "pct_mito")
    missing = [column for column in required if column not in adata.obs]
    if missing:
        raise HTTPException(status_code=503, detail=f"Missing cluster fields: {', '.join(missing)}")
    labels = np.asarray(adata.obs["leiden"].astype(str))
    mask = labels == cluster_id
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_id}' not found")
    if "X_umap" not in adata.obsm or adata.obsm["X_umap"].shape[0] != adata.n_obs:
        raise HTTPException(status_code=503, detail="UMAP coordinates are unavailable or misaligned")

    indices = np.flatnonzero(mask)
    coordinates = adata.obsm["X_umap"]
    cells = [
        {
            "cell_index": int(index),
            "x": float(coordinates[index, 0]),
            "y": float(coordinates[index, 1]),
            "n_genes": float(adata.obs["n_genes"].iloc[index]),
            "total_counts": float(adata.obs["total_counts"].iloc[index]),
            "pct_mito": float(adata.obs["pct_mito"].iloc[index]),
        }
        for index in indices
    ]
    enriched = _marker_summary(adata, mask, top_n, "enriched")
    depleted = _marker_summary(adata, mask, top_n, "depleted")
    raw_counts = adata.layers.get("counts")
    raw_expression = []
    if raw_counts is not None:
        gene_indices = [adata.var_names.get_loc(item["gene"]) for item in enriched]
        selected_counts = raw_counts[indices][:, gene_indices]
        if sparse.issparse(selected_counts):
            selected_counts = selected_counts.toarray()
        raw_expression = [
            {"cell_index": int(cell_index), "values": [float(value) for value in row]}
            for cell_index, row in zip(indices, np.asarray(selected_counts))
        ]

    return {
        "cluster": cluster_id,
        "n_cells": len(cells),
        "cells": cells,
        "markers": enriched,
        "depleted": depleted,
        "raw_counts": {"genes": [item["gene"] for item in enriched], "cells": raw_expression},
    }


COMPARISON_GENES = [
    "PPBP", "PF4", "GP9", "TUBB1", "RGS18", "GNG11", "SDPR", "SPARC", "NRGN", "CD9", "CCL5", "CLU", "TPM4", "TAGLN2", "RGS10",
    "CD3D", "CD3E", "TRBC1", "TRBC2", "LTB", "NKG7", "GNLY", "MS4A1", "CD79A", "CD37", "CD74",
    "LST1", "S100A8", "S100A9", "LILRB1", "FCN1", "CTSS",
]
PROGRAM_GENES = {
    "platelet_megakaryocyte_associated": ["PPBP", "PF4", "GP9", "TUBB1", "NRGN", "RGS18"],
    "T_NK_associated": ["CD3D", "CD3E", "TRBC1", "NKG7", "GNLY", "CCL5"],
    "monocyte_associated": ["LST1", "LILRB1", "FCN1", "S100A8", "S100A9"],
    "B_cell_associated": ["MS4A1", "CD79A", "CD74"],
}


@app.get("/api/cluster/{cluster_id}/comparison")
def cluster_comparison(cluster_id: str, request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    labels = np.asarray(adata.obs["leiden"].astype(str))
    mask = labels == cluster_id
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_id}' not found")
    clusters = sorted(np.unique(labels), key=lambda value: (int(value) if value.isdigit() else value))
    available = [gene for gene in COMPARISON_GENES if gene in adata.var_names]
    missing = [gene for gene in COMPARISON_GENES if gene not in adata.var_names]
    gene_indices = [adata.var_names.get_loc(gene) for gene in available]
    values = adata.X[:, gene_indices]
    if sparse.issparse(values):
        values = values.toarray()
    values = np.asarray(values, dtype=float)
    cluster_rows = []
    for gene_index, gene in enumerate(available):
        means = {cluster: float(values[labels == cluster, gene_index].mean()) for cluster in clusters}
        fractions = {cluster: float((values[labels == cluster, gene_index] > 0).mean()) for cluster in clusters}
        other_clusters = [cluster for cluster in clusters if cluster != cluster_id]
        highest = max(other_clusters, key=lambda cluster: means[cluster])
        cluster_rows.append({"gene": gene, "means": means, "fractions": fractions, "cluster6_mean": means[cluster_id], "highest_other_mean": means[highest], "highest_other_cluster": highest, "cluster6_fraction": fractions[cluster_id]})
    heatmap = {"genes": available, "clusters": clusters, "values": [[row["means"][cluster] for cluster in clusters] for row in cluster_rows]}
    cell_indices = np.flatnonzero(mask)
    normalized_cells = values[mask]
    program_rows = []
    for row_index, cell_index in enumerate(cell_indices):
        scores = {}
        for program, genes in PROGRAM_GENES.items():
            present = [available.index(gene) for gene in genes if gene in available]
            scores[program] = float(normalized_cells[row_index, present].mean()) if present else 0.0
        program_rows.append({"cell_index": int(cell_index), "scores": scores})
    program_genes = {program: [gene for gene in genes if gene in available] for program, genes in PROGRAM_GENES.items()}
    raw_layer = adata.layers.get("counts")
    raw_cells = []
    if raw_layer is not None:
        raw = raw_layer[cell_indices][:, gene_indices]
        if sparse.issparse(raw): raw = raw.toarray()
        raw_cells = [{"cell_index": int(index), "values": [float(value) for value in row]} for index, row in zip(cell_indices, np.asarray(raw))]
    return {"cluster": cluster_id, "n_cells": int(mask.sum()), "genes": available, "missing_genes": missing, "cluster_values": cluster_rows, "heatmap": heatmap, "program_genes": program_genes, "programs": program_rows, "raw_counts": {"genes": available, "cells": raw_cells}}


@app.get("/api/cluster-data")
def cluster_data(request: Request) -> dict[str, object]:
    adata = request.app.state.adata
    required_columns = ("leiden", "n_genes", "total_counts", "pct_mito")
    missing = [column for column in required_columns if column not in adata.obs]
    if missing:
        raise HTTPException(status_code=503, detail=f"Missing cluster data fields: {', '.join(missing)}")

    return {
        "n_cells": adata.n_obs,
        "clusters": [str(value) for value in adata.obs["leiden"]],
        "n_genes": [float(value) for value in adata.obs["n_genes"]],
        "total_counts": [float(value) for value in adata.obs["total_counts"]],
        "pct_mito": [float(value) for value in adata.obs["pct_mito"]],
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

# DDLS Week 5 Single-Cell Navigator

A FastAPI-served single-cell viewer for the supplied PBMC AnnData dataset. It provides an interactive UMAP, searchable gene-expression coloring, cluster selection, cluster-level QC distributions, and evidence views for investigating Leiden cluster 6.

## Requirements and setup

Use Python 3.10+ with the dependencies in `requirements.txt` (FastAPI, Uvicorn, Scanpy, NumPy, SciPy, and related scientific packages).

Place the supplied dataset at:

```text
data/pbmc3k.h5ad
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the application from the repository root:

```bash
uvicorn app.main:app --reload
```

Open the viewer at:

```text
http://localhost:8000
```

The application loads the AnnData object once at startup. The viewer supports UMAP navigation, manual or searchable gene selection, continuous gene-expression coloring, cluster coloring and highlighting, all-cluster QC box plots, per-cell QC tables, enriched/depleted expression summaries, cluster comparisons, raw-count views, and transparent per-cell expression-program evidence.

## Cluster 6 conclusion

Cluster 6 contains 13 cells. The evidence-based conclusion in the viewer is:

> **Platelet/megakaryocyte-associated expression program.**

This is supported by a compact UMAP group and consistent enrichment of PPBP, PF4, GP9, TUBB1, and RGS18 relative to other clusters. CCL5 is also detected, but canonical tested T/NK-associated markers such as CD3D, GNLY, and NKG7 do not provide comparable support. The cluster is small; no external annotation or dedicated doublet classifier was applied, so the evidence does not establish novelty or exclude doublets.

## Dataset and optional public access

The `.h5ad` dataset is intentionally excluded from GitHub because of its size and is required locally at `data/pbmc3k.h5ad`.

When the app is running locally, Cloudflare Quick Tunnel can optionally expose it through a temporary public HTTPS URL. A Quick Tunnel is temporary and should not be treated as production hosting.

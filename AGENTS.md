# AGENTS.md

## Project context

This is the DDLS Week 5 single-cell RNA-seq PBMC project. The intended application is a live single-cell data navigator for investigating the supplied PBMC dataset. The first biological investigation is cluster 6; cluster 4 is a secondary/follow-up investigation.

## Technical architecture

The intended stack is:

- Python
- FastAPI
- Uvicorn
- Scanpy / AnnData
- NumPy, Pandas, and SciPy as needed
- HTML/JavaScript frontend
- Tailwind CSS via CDN
- Plotly for interactive visualization

The project does **not** use React, npm/Node.js build tooling, Streamlit, Gradio, or a separate frontend framework/build system. FastAPI should serve the frontend at `http://localhost:8000`; do not open the HTML file directly from disk.

## Data handling rules

- Load the `.h5ad` dataset once at application startup; do not reload it for every API request.
- Inspect the actual `.h5ad` structure before making implementation decisions.
- Do not assume where UMAP coordinates, cluster labels, gene expression, raw counts, or QC metrics are stored.
- Verify the actual AnnData structure with Python/Scanpy.
- Do not invent missing biological information.

## Scientific interpretation rules

- Use marker genes to interpret clusters.
- UMAP geometry alone is not sufficient to assign a biological identity.
- A low gene count alone does not establish that a cell is junk.
- Inspect mitochondrial percentage and marker expression when assessing quality.
- High counts/genes can be compatible with doublets.
- Co-expression of lineage markers can be evidence worth investigating for doublets.
- Separation on a UMAP does not by itself establish a novel biological population.
- Novelty requires comparison with known cell-type signatures and neighboring clusters.
- When available, use raw counts for doublet-related co-expression checks.
- Verify application-derived numbers independently with plain Python where practical.

These rules support cautious investigation; they are not stronger biological conclusions than the source material supports.

## Development workflow

1. Inspect existing files before modifying them.
2. Make one focused change at a time.
3. Run relevant verification after each change.
4. Test API behavior independently from browser behavior.
5. Cross-check important scientific numbers with Python/Scanpy.
6. Inspect browser behavior manually.
7. Use browser developer tools and network information when debugging frontend/API problems.
8. Keep the core application working before adding stretch features.
9. Commit meaningful milestones to Git.
10. Do not make large unrelated changes in one step.

If a requirement is ambiguous, identify the ambiguity rather than inventing a solution.

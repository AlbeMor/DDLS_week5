# AGENTS.md

## Technical architecture

- Use Python with FastAPI and Uvicorn.
- Use Scanpy / AnnData, with NumPy, Pandas, and SciPy as needed.
- Use an HTML/JavaScript frontend, Tailwind CSS via CDN, and Plotly for interactive visualization.
- Do not introduce React, npm/Node.js build tooling, Streamlit, Gradio, or another frontend framework/build system.
- FastAPI should serve the frontend at `http://localhost:8000`; do not open HTML directly from disk.

## Data rules

- Inspect the actual `.h5ad` structure before making assumptions or implementation decisions.
- Do not invent missing data or biological information.
- Verify where UMAP coordinates, cluster labels, expression matrices, raw counts, and QC fields are stored.
- Load the dataset once at application startup rather than once per request.

## Scientific rules

- Use marker genes to interpret clusters.
- UMAP geometry alone does not establish biological identity or novelty.
- Consider relevant QC metrics when evaluating clusters; a single metric is not conclusive by itself.
- Investigate possible doublets using appropriate evidence, including marker co-expression and raw counts when available.
- Independently verify important numerical results with plain Python/Scanpy.

## Development rules

- Inspect existing files before modifying them.
- Make focused, incremental changes.
- Run relevant tests or verification after changes.
- Debug backend/API behavior separately from frontend/browser behavior.
- Inspect browser behavior manually when relevant.
- Keep working functionality intact.
- Commit meaningful milestones.

## Git and repository rules

- Never commit secrets, `.env`, `.venv`, caches, or unintended large files.
- Check `git status` before committing.
- Use meaningful commit messages.
- Never force-push or rewrite history unless explicitly requested.

## Ambiguity

When requirements or data are unclear, identify the ambiguity instead of guessing.

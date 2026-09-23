# PBMC Dataset Audit

## 1. Dataset files

The archive `ddls-week5-s2-novel-or-known-dataset.zip` contains:

- `data/pbmc3k.h5ad` — the processed PBMC dataset.
- `data/ABOUT_THIS_FILE.txt` — a short description of the dataset and its intended AnnData fields.

The archive was inspected and the `.h5ad` was opened successfully with the existing project environment using Scanpy. It was audited from a temporary extraction and no dataset file was added to the repository or permanently extracted into the project.

## 2. AnnData dimensions

The actual AnnData object has:

- `n_obs = 2,700` cells.
- `n_vars = 13,714` genes.
- `X.shape = (2700, 13714)`.

Cell identifiers are in `adata.obs_names`; they are unique. Example identifiers include `AAACATACAACCAC-1`. Gene identifiers are in `adata.var_names`; they are unique and are gene symbols such as `AL627309.1` and `LINC00115`.

## 3. AnnData structure

### `obs`

Available columns:

- `n_genes` (`int32`)
- `total_counts` (`float32`)
- `pct_mito` (`float32`)
- `leiden` (`category`)

### `var`

Available columns:

- `gene_ids`
- `mt`
- `n_cells_by_counts`
- `mean_counts`
- `log1p_mean_counts`
- `pct_dropout_by_counts`
- `total_counts`
- `log1p_total_counts`
- `n_cells`
- `highly_variable`
- `means`
- `dispersions`
- `dispersions_norm`

### `obsm`

- `X_umap`, shape `(2700, 2)`.

### `layers`

- `counts`, shape `(2700, 13714)`.
- `None`, shape `(2700, 13714)`.

### `.raw`

- `.raw` is not present (`adata.raw is None`).

### `uns`

- `hvg` is present.

The main `adata.X` matrix is a CSR sparse matrix of `float32` values with shape `(2700, 13714)`. The archive description identifies it as log-normalised expression. The `counts` layer is identified as raw UMI counts. The layer named `None` is present but its provenance is not established by this audit and should not be used without further verification.

## 4. Cluster information

The cluster-label column is `adata.obs["leiden"]`. It is a categorical column whose values are string labels, not biological cell-type names. The observed labels and cell counts are:

| Cluster label | Cells |
|---:|---:|
| 0 | 1,197 |
| 1 | 489 |
| 2 | 445 |
| 3 | 347 |
| 4 | 163 |
| 5 | 36 |
| 6 | 13 |
| 7 | 10 |

These counts sum to 2,700 and match the cluster sizes in the interview summary.

## 5. UMAP information

UMAP coordinates are stored in `adata.obsm["X_umap"]`. Their shape is `(2700, 2)`, providing one coordinate pair for every cell. The coordinates are therefore available for visualization and neighborhood/context inspection. They are embedding coordinates, not directly interpretable biological measurements.

## 6. QC information

The relevant per-cell QC fields are present in `adata.obs`:

- `n_genes`: number of detected genes.
- `pct_mito`: mitochondrial percentage.
- `total_counts`: total counts.

Dataset-wide summaries from the actual object are:

| Field | Mean | Median | Minimum | Maximum |
|---|---:|---:|---:|---:|
| `n_genes` | 846.99 | 817 | 212 | 3,422 |
| `total_counts` | 2,366.90 | 2,197 | 548 | 15,844 |
| `pct_mito` | 2.215 | 2.030 | 0 | 22.569 |

The interview’s cluster QC values are summary values and are not all directly equivalent to the cluster-level mean. In particular, the dataset stores per-cell QC values, so later application code must define whether it reports mean, median, or another summary.

## 7. Expression and raw-count information

- Main expression: `adata.X`, a CSR sparse `float32` matrix described in the archive metadata as log-normalised expression.
- Raw counts: `adata.layers["counts"]` is available and has the full `(2700, 13714)` shape.
- `.raw`: unavailable.
- Gene identifiers: `adata.var_names`, with additional identifiers in `adata.var["gene_ids"]`.

For visualization, `adata.X` is the appropriate currently documented expression representation. For marker analysis, the existing processed expression and Scanpy metadata should be assessed after the audit, with the analysis matrix explicitly documented. For doublet-related co-expression checks, the available `counts` layer should be preferred because it contains raw UMI counts. No marker calculations were performed in this audit.

## 8. Cluster 6 audit

Cluster 6 is represented by the categorical/string label `"6"` in `adata.obs["leiden"]` and contains 13 cells, confirming the interview statement.

Per-cell `n_genes` summary for the actual cluster-6 cells:

| Statistic | Value |
|---|---:|
| Mean | 576.15 |
| Median | 350 |
| Minimum | 212 |
| Maximum | 2,455 |

Per-cell `pct_mito` summary:

| Statistic | Value |
|---|---:|
| Mean | 1.926% |
| Median | 1.568% |
| Minimum | 0.678% |
| Maximum | 3.221% |

Per-cell `total_counts` summary:

| Statistic | Value |
|---|---:|
| Mean | 1,659.85 |
| Median | 917 |
| Minimum | 568 |
| Maximum | 8,931 |

The cluster-6 UMAP coordinates are available. Their range and centroid are:

- Minimum: `(13.1526, 11.2167)`
- Maximum: `(14.0016, 11.5568)`
- Centroid: `(13.3795, 11.4407)`

These are structural measurements only; no biological identity or novelty conclusion is made here.

The interview reports 350 genes per cell and 1.6% mitochondrial reads for cluster 6. In the actual data, 350 is the median `n_genes` and 1.6% is close to the median `pct_mito` (the exact median is approximately 1.568%). The actual cluster contains substantial per-cell variation, including one cell with 2,455 detected genes and 8,931 total counts, so later summaries must not silently treat the interview values as means or as values for every cell.

## 9. Cluster 4 audit

Cluster 4 is represented by the categorical/string label `"4"` in `adata.obs["leiden"]` and contains 163 cells, confirming the interview statement.

Per-cell `n_genes` summary:

| Statistic | Value |
|---|---:|
| Mean | 1,216.27 |
| Median | 1,263 |
| Minimum | 390 |
| Maximum | 1,938 |

Per-cell `pct_mito` summary:

| Statistic | Value |
|---|---:|
| Mean | 2.551% |
| Median | 2.408% |
| Minimum | 0.126% |
| Maximum | 22.569% |

Per-cell `total_counts` summary:

| Statistic | Value |
|---|---:|
| Mean | 3,666.95 |
| Median | 3,782 |
| Minimum | 678 |
| Maximum | 7,171 |

UMAP coordinates are available for all 163 cluster-4 cells:

- Minimum: `(15.2740, 10.1623)`
- Maximum: `(18.4505, 12.7430)`
- Centroid: `(16.4722, 11.7197)`

No novelty assessment or biological identity assignment was performed.

## 10. Interview vs dataset comparison

| Item | Interview summary | Actual dataset | Status |
|---|---|---|---|
| Total cells | 2,700 | 2,700 | Confirmed |
| Cluster sizes | 1,197; 489; 445; 347; 163; 36; 13; 10 | Same counts for labels 0–7 | Confirmed |
| Cluster 6 size | 13 | 13 | Confirmed |
| Cluster 6 `n_genes` | 350 genes/cell | Mean 576.15; median 350; range 212–2,455 | Median confirmed; summary statistic was unspecified |
| Cluster 6 mitochondrial percentage | 1.6% | Mean 1.926%; median 1.568%; range 0.678–3.221% | Approximately confirmed as a central summary; statistic was unspecified |
| Cluster 4 size | 163 | 163 | Confirmed |
| Full expression dimensions | Not supplied in interview | 2,700 × 13,714 | Available in dataset |
| UMAP coordinates | Not supplied in interview | `obsm["X_umap"]`, 2,700 × 2 | Available in dataset |
| Gene-level expression | Not supplied in interview | `X` and `layers["counts"]` available | Available in dataset |

The interview did not specify whether its `n_genes` and mitochondrial values were means, medians, or another summary. The dataset confirms the values as cluster-6 central summaries but shows that they are not identical for every cell.

## 11. Missing or ambiguous information

The audit found the following limitations or points requiring explicit implementation decisions:

- `.raw` is unavailable. Raw UMI counts are available in `layers["counts"]`, which should be used where raw-count checks are required.
- The layer named `None` is present, but its provenance and intended use are not established by this audit.
- The exact marker-analysis representation has not yet been selected or calculated. This should be decided and documented during implementation after confirming the intended Scanpy workflow.
- The interview’s cluster QC summaries do not specify the aggregation statistic. The application should label whether it reports mean, median, range, or another statistic.
- Cluster labels are numeric-looking strings in a categorical column, not named biological identities.
- The dataset provides UMAP coordinates but does not by itself provide biological identity labels or evidence that any cluster is novel.
- No marker genes were calculated in this audit, by design.

## 12. Recommendations for the next implementation step

1. Load `data/pbmc3k.h5ad` through a single application-level data-loading path and retain the loaded AnnData object for request handling.
2. Use `obs["leiden"]` as the cluster selector source, preserving labels as strings unless a later interface decision requires conversion.
3. Use `obsm["X_umap"]` for the UMAP coordinates and document the selected expression representation for gene coloring.
4. Use `obs["n_genes"]`, `obs["pct_mito"]`, and `obs["total_counts"]` for quality displays, with clearly labeled aggregation statistics for cluster views.
5. Use `layers["counts"]` for later raw-count co-expression checks; do not rely on `.raw`.
6. Validate API-derived dimensions, cluster counts, QC summaries, and coordinates against direct Scanpy/Python calculations.
7. Keep marker calculation and biological interpretation separate from the data-loading audit, and do not infer identities from UMAP geometry alone.
8. Decide and document the precise marker-analysis matrix and response fields before implementing cluster-inspection endpoints.

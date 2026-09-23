# DDLS Week 5 Project Specification

## 3.1 Project objective

### Application objective

Build a live single-cell data navigator for the supplied PBMC `.h5ad` dataset. The application should provide an interactive UMAP, gene coloring, cluster inspection, and relevant quality/marker information through a FastAPI-served HTML/JavaScript interface.

### Biological investigation objective

Use the navigator to investigate the biological question supplied by the data owner. The first priority is one defensible identity call for cluster 6, supported by gene markers, map/UMAP context, QC metrics, and consistency across the cells in that cluster. Cluster 4 is a later, secondary investigation concerning an initial novelty concern.

The application objective and the biological objective are related but distinct: the application provides evidence for investigation; it must not manufacture or overstate a biological conclusion.

## 3.2 Dataset context

The dataset is a PBMC dataset, where PBMC means peripheral blood mononuclear cells. The interview describes approximately 2,700 cells assigned to numbered clusters 0–7 on a two-dimensional embedding. The interview does not provide the full expression-matrix dimensions or gene names.

The cluster summary supplied by the data owner is:

| Cluster | Cells | Genes/cell | % mito |
|---:|---:|---:|---:|
| 0 | 1,197 | 809 | 1.8 |
| 1 | 489 | 850 | 2.3 |
| 2 | 445 | 828 | 2.3 |
| 3 | 347 | 673 | 2.1 |
| 4 | 163 | 1,263 | 2.4 |
| 5 | 36 | 1,570 | 2.0 |
| 6 | 13 | 350 | 1.6 |
| 7 | 10 | 2,363 | 2.0 |

These values are interview-provided summary values and must be checked against the actual dataset before being treated as application-derived results.

The owner initially focused on cluster 4 because it appeared visually distinct and had 163 cells, but did not know its identity and wondered whether it might be a rare or novel population. The urgent PI handoff instead prioritizes cluster 6: it has 13 cells, 350 genes per cell, and 1.6% mitochondrial reads. Cluster 6 must therefore be investigated first; the original cluster-4 question remains secondary.

## 3.3 Primary biological question

Determine the biological identity of cluster 6 and assess whether its observed separation represents a coherent cell population or can instead be explained by a known PBMC cell type, low-quality cells, or another technical/biological explanation.

The investigation should seek one defensible identity call supported by:

- gene markers;
- map/UMAP context;
- QC metrics; and
- consistency across the cells in cluster 6.

The application must support inspection of enriched genes in the 13 cells, their UMAP neighborhood, relevant QC values, and whether the observed pattern occurs across several or all cluster-6 cells.

## 3.4 Cluster 6 information currently known

The interview establishes that:

- cluster 6 contains 13 cells;
- the owner’s summary reports `n_genes = 350` per cell;
- the owner’s summary reports a mitochondrial fraction of 1.6%;
- the owner wants genes enriched in those cells investigated;
- UMAP neighborhood/context should be inspected; and
- consistency across several or all 13 cells should be evaluated.

The interview does **not** provide the actual marker genes or UMAP coordinates. Cluster 6’s identity must not be inferred at this stage. Those values must be obtained from and verified against the actual `.h5ad` dataset.

The interview also records uncertainty about whether numbered groups reflect real biology rather than clustering or embedding quirks. The analysis must therefore avoid treating cluster membership or separation as independently validated biological fact.

## 3.5 Secondary question: cluster 4

Cluster 4 was the original novelty concern:

- it contains 163 cells according to the interview summary;
- it appeared visually distinct to the owner; and
- its identity was initially unknown.

Cluster 4 is secondary to cluster 6 for the first implementation and investigation. Once the core navigator and cluster-6 investigation are stable, the workflow may support comparison of cluster 4 with:

- top genes;
- neighboring clusters;
- established cell-type signatures;
- QC; and
- expression consistency across cells.

UMAP separation and QC alone cannot establish novelty. A novelty assessment requires comparison with known cell-type signatures and neighboring clusters.

## 3.6 Core application requirements

The following minimum functionality must work before any stretch feature is attempted:

1. Provide a UMAP visualization.
2. Allow the UMAP to be colored by a selected gene.
3. Display cell-quality information.
4. Provide a cluster selector/picker.
5. Provide a Run/Inspect control for the selected cluster.
6. Display the selected cluster’s top marker genes.
7. Display relevant quality metrics for the selected cluster.
8. Provide enough map context to understand the selected cluster relative to other cells/clusters.
9. Use a mobile-friendly layout.

The application should be generic enough to inspect any cluster, while treating cluster 6 as the primary biological target.

## 3.7 Intended API

The recommended endpoints are documented here for later implementation only; they must not be implemented during this specification phase.

### `GET /api/umap`

Provide coordinates and the information required to render the UMAP. It should support cluster and/or gene coloring as required by the frontend. Exact response fields depend on the dataset audit.

### `GET /api/gene/{name}`

Return expression information for a requested gene and validate that the gene exists. Exact response fields and expression representation depend on the audited AnnData structure.

### `GET /api/cluster/{id}`

Return information needed to investigate a cluster, eventually including marker information and relevant QC metrics. Exact response fields and marker calculation details must be determined after auditing the dataset.

Do not invent an exact JSON schema before the `.h5ad` structure and matrix choices are known.

## 3.8 Data audit requirements

Before implementing the core application, perform a dedicated audit of the actual `.h5ad`. Determine where the following are stored:

- cell identifiers;
- gene identifiers;
- expression matrix;
- raw counts, if available;
- UMAP coordinates;
- cluster labels;
- `n_genes` / gene-count QC;
- mitochondrial percentage;
- other relevant QC metrics;
- layers;
- `.raw`;
- `obs`;
- `var`;
- `obsm`; and
- `uns`.

The audit must also determine:

- whether cluster labels are categorical or numeric/string;
- which matrix should be used for visualization;
- which matrix should be used for marker analysis; and
- whether raw counts are available for doublet-related checks.

Do not assume any of these structures. The actual dataset must be inspected with Python/Scanpy before implementation decisions are made. The dataset filename must not be invented or assumed from this specification.

## 3.9 Validation requirements

Important numerical results must have independent checks. Examples include:

- verifying cluster sizes with Python/Scanpy;
- verifying cluster-6 QC values;
- verifying marker calculations;
- verifying UMAP coordinates; and
- comparing API output against direct AnnData calculations.

The browser is not the scientific source of truth. Application-derived values should be cross-checked with plain Python where practical.

Scientific interpretation must remain cautious. Marker patterns should be evaluated across cells, in map context, and against known signatures. A low gene count alone does not establish that a cell is junk; high counts or genes can be compatible with doublets; and lineage-marker co-expression may warrant investigation for doublets. Where raw counts are available, use them for doublet-related co-expression checks.

## 3.10 Stretch features

Stretch features are explicitly secondary and may be considered only after the core navigator is stable. Possible future additions include further interactive analysis and comparison views that help investigate clusters, markers, neighboring clusters, QC, and established cell-type signatures.

No stretch feature is required or should be implemented during this specification phase.

## 3.11 Explicit non-goals for the current phase

This phase does not include:

- building the application;
- biological interpretation of cluster 6;
- assigning cluster identities;
- claiming cluster 4 is novel;
- calculating markers before the dataset audit;
- frontend implementation;
- API implementation;
- deployment;
- GitHub Pages; or
- stretch features.

In particular, do not assign a cell type to cluster 6, name its marker genes, claim that cluster 6 is novel, claim that cluster 4 is novel, claim that a cluster is low quality based only on its size, or claim that UMAP separation proves biological distinctness. Unknowns from the interview remain unknown until answered by an audit of the actual `.h5ad`.

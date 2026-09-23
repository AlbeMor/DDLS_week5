const plotElement = document.getElementById("umap-plot");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const cellCount = document.getElementById("cell-count");
const geneCount = document.getElementById("gene-count");
const selection = document.getElementById("selection");
const plotTitle = document.getElementById("plot-title");
const geneForm = document.getElementById("gene-form");
const geneInput = document.getElementById("gene-input");
const geneSuggestions = document.getElementById("gene-suggestions");
const geneListStatus = document.getElementById("gene-list-status");
const modeSelect = document.getElementById("mode-select");
const clusterControls = document.getElementById("cluster-controls");
const clusterSelect = document.getElementById("cluster-select");
const clusterSummary = document.getElementById("cluster-summary");
const qcSection = document.getElementById("qc-section");
const clusterAnalysis = document.getElementById("cluster-analysis");
const clusterAnalysisOverview = document.getElementById("cluster-analysis-overview");
const clusterCellsTable = document.getElementById("cluster-cells-table");
const clusterMarkersTable = document.getElementById("cluster-markers-table");
const clusterDepletedTable = document.getElementById("cluster-depleted-table");
const clusterCellCount = document.getElementById("cluster-cell-count");
const clusterMedianGenes = document.getElementById("cluster-median-genes");
const clusterMedianCounts = document.getElementById("cluster-median-counts");
const clusterMedianMito = document.getElementById("cluster-median-mito");

let umapData;
let clusterData;
const clusterColors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#17becf"];
let clusterColorMap = new Map();
let geneList = null;
let geneListPromise = null;

function showError(message) {
  errorState.textContent = message;
  errorState.hidden = false;
}

function clearError() {
  errorState.textContent = "";
  errorState.hidden = true;
}

async function loadGeneList() {
  if (geneList) return geneList;
  if (!geneListPromise) {
    geneListStatus.textContent = "Loading gene list…";
    geneListPromise = fetchJson("/api/genes").then((result) => {
      if (!Number.isInteger(result.n_genes) || !Array.isArray(result.genes) || result.genes.length !== result.n_genes) {
        throw new Error("The gene list response is invalid.");
      }
      geneList = result.genes;
      geneListStatus.textContent = `${result.n_genes.toLocaleString()} genes available`;
      return geneList;
    }).catch((error) => {
      geneListStatus.textContent = "Gene search unavailable; exact entry remains available.";
      geneListPromise = null;
      throw error;
    });
  }
  return geneListPromise;
}

function hideGeneSuggestions() {
  geneSuggestions.hidden = true;
  geneInput.setAttribute("aria-expanded", "false");
}

function showGeneSuggestions(matches) {
  geneSuggestions.replaceChildren();
  matches.slice(0, 30).forEach((gene) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "gene-suggestion";
    option.setAttribute("role", "option");
    option.textContent = gene;
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => {
      geneInput.value = gene;
      hideGeneSuggestions();
      geneInput.focus();
    });
    geneSuggestions.appendChild(option);
  });
  geneSuggestions.hidden = matches.length === 0;
  geneInput.setAttribute("aria-expanded", String(matches.length > 0));
}

async function updateGeneSuggestions() {
  const query = geneInput.value.trim().toLowerCase();
  if (!query) { hideGeneSuggestions(); return; }
  try {
    const genes = await loadGeneList();
    const matches = genes.filter((gene) => gene.toLowerCase().includes(query));
    showGeneSuggestions(matches);
  } catch (error) {
    hideGeneSuggestions();
    if (!errorState.hidden) return;
    showError(error.message || "Unable to load the gene list.");
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed (HTTP ${response.status}).`);
  }
  return payload;
}

function validateCellAlignedData(data) {
  const fields = ["clusters", "n_genes", "total_counts", "pct_mito"];
  if (!Number.isInteger(data.n_cells) || !fields.every((field) => Array.isArray(data[field]) && data[field].length === data.n_cells)) {
    throw new Error("The cluster data response contains mismatched cell-aligned arrays.");
  }
  if (data.n_cells !== umapData.n_cells || umapData.coordinates.length !== data.n_cells) {
    throw new Error("The cluster data and UMAP responses contain different numbers of cells.");
  }
  if (!data.clusters.every((value) => typeof value === "string")) {
    throw new Error("The cluster data response contains invalid cluster labels.");
  }
  for (const field of fields.slice(1)) {
    if (!data[field].every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new Error(`The cluster data response contains invalid values for ${field}.`);
    }
  }
}

async function loadDatasetInfo() {
  const [umap, health, clusters] = await Promise.all([
    fetchJson("/api/umap"),
    fetchJson("/api/health"),
    fetchJson("/api/cluster-data"),
  ]);
  if (!Array.isArray(umap.coordinates) || umap.coordinates.length !== umap.n_cells) {
    throw new Error("The UMAP response has an unexpected number of coordinates.");
  }
  umapData = umap;
  validateCellAlignedData(clusters);
  return { health, clusters };
}

function baseLayout() {
  return {
    margin: { l: 58, r: 24, t: 18, b: 52 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    hovermode: "closest",
    xaxis: { title: "UMAP 1", zeroline: false, showgrid: true, gridcolor: "#e2e9ed" },
    yaxis: { title: "UMAP 2", zeroline: false, showgrid: true, gridcolor: "#e2e9ed" },
    dragmode: "pan",
  };
}

const plotConfig = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["select2d", "lasso2d"],
};

function renderUmap(expression = null, gene = null) {
  const coordinates = umapData.coordinates;
  if (expression && expression.length !== coordinates.length) {
    throw new Error("The UMAP and gene-expression responses contain different numbers of cells.");
  }
  const x = coordinates.map((point) => point.x);
  const y = coordinates.map((point) => point.y);
  const cellIndices = coordinates.map((_, index) => index);
  const trace = {
    x, y, mode: "markers", type: "scattergl",
    marker: expression ? {
      size: 7, color: expression, colorscale: "Viridis", showscale: true,
      colorbar: { title: { text: `${gene} expression` } }, opacity: 0.82,
    } : { size: 7, color: "#176b87", opacity: 0.78 },
    customdata: expression ? cellIndices.map((index) => [index, expression[index]]) : cellIndices.map((index) => [index]),
    hovertemplate: expression
      ? "Cell index: %{customdata[0]}<br>UMAP 1: %{x:.4f}<br>UMAP 2: %{y:.4f}<br>" + `${gene} expression: %{customdata[1]:.6g}<extra></extra>`
      : "Cell index: %{customdata[0]}<br>UMAP 1: %{x:.4f}<br>UMAP 2: %{y:.4f}<extra></extra>",
  };
  Plotly.react(plotElement, [trace], baseLayout(), plotConfig);
  plotTitle.textContent = gene ? `UMAP colored by ${gene}` : "UMAP overview";
}

function renderClusterUmap(selectedCluster) {
  const coordinates = umapData.coordinates;
  const traces = [...new Set(clusterData.clusters)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((cluster) => {
    const indices = clusterData.clusters.map((value, index) => value === cluster ? index : -1).filter((index) => index >= 0);
    return {
      x: indices.map((index) => coordinates[index].x),
      y: indices.map((index) => coordinates[index].y),
      mode: "markers",
      type: "scattergl",
      name: cluster,
      marker: {
        size: cluster === selectedCluster ? 9 : 6,
        color: clusterColorMap.get(cluster),
        opacity: cluster === selectedCluster ? 1 : 0.8,
        line: cluster === selectedCluster ? { color: "#18212b", width: 2 } : { width: 0 },
      },
      customdata: indices,
      hovertemplate: "Cell index: %{customdata}<br>Cluster: " + cluster + "<br>UMAP 1: %{x:.4f}<br>UMAP 2: %{y:.4f}<extra></extra>",
    };
  });
  const layout = { ...baseLayout(), title: { text: `Cluster view — selected cluster ${selectedCluster}` }, legend: { title: { text: "Cluster" } } };
  Plotly.react(plotElement, traces, layout, plotConfig);
  plotTitle.textContent = `UMAP — selected cluster ${selectedCluster}`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function renderQcPlot(elementId, valuesByCluster, title, axisTitle) {
  const traces = valuesByCluster.map(({ cluster, values }) => ({
    type: "box",
    name: cluster,
    x: values.map(() => cluster),
    y: values,
    boxpoints: "outliers",
    jitter: 0,
    pointpos: 0,
    marker: { color: clusterColorMap.get(cluster) },
    line: { color: clusterColorMap.get(cluster), width: 1.5 },
    fillcolor: `${clusterColorMap.get(cluster)}66`,
    hovertemplate: `Cluster ${cluster}<br>${axisTitle}: %{y}<extra></extra>`,
  }));
  Plotly.react(document.getElementById(elementId), traces, {
    margin: { l: 55, r: 16, t: 48, b: 45 },
    title: { text: title, font: { size: 14 } },
    xaxis: { title: "Cluster", categoryorder: "array", categoryarray: valuesByCluster.map(({ cluster }) => cluster) },
    yaxis: { title: axisTitle },
    showlegend: false,
    boxmode: "group",
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
  }, plotConfig);
}

function formatNumber(value, digits = 2) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }); }

function sortableTable(rows, columns, container, sortKey) {
  let currentKey = sortKey;
  let descending = true;
  const draw = () => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[currentKey]; const bv = b[currentKey];
      return typeof av === "number" ? (descending ? bv - av : av - bv) : (descending ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv)));
    });
    container.replaceChildren();
    const table = document.createElement("table"); table.className = "analysis-table";
    const head = table.createTHead().insertRow();
    columns.forEach(([key, label]) => { const th = document.createElement("th"); const button = document.createElement("button"); button.textContent = label; button.addEventListener("click", () => { if (currentKey === key) descending = !descending; else { currentKey = key; descending = true; } draw(); }); th.appendChild(button); head.appendChild(th); });
    const body = table.createTBody();
    sorted.forEach((row) => { const tr = body.insertRow(); columns.forEach(([key]) => { const td = tr.insertCell(); td.textContent = typeof row[key] === "number" ? formatNumber(row[key]) : row[key]; }); });
    container.appendChild(table);
  };
  draw();
}

async function loadClusterAnalysis(cluster) {
  clusterAnalysis.hidden = cluster !== "6";
  if (cluster !== "6") return;
  try {
    const data = await fetchJson(`/api/cluster/${encodeURIComponent(cluster)}`);
    if (data.n_cells !== 13 || !Array.isArray(data.cells) || data.cells.length !== 13) throw new Error("Cluster 6 analysis does not contain exactly 13 cells.");
    const med = (key) => median(data.cells.map((cell) => cell[key]));
    clusterAnalysisOverview.innerHTML = `<div><span>Cluster</span><strong>${data.cluster}</strong></div><div><span>Cells</span><strong>${data.n_cells}</strong></div><div><span>Median genes/cell</span><strong>${formatNumber(med("n_genes"))}</strong></div><div><span>Median total counts</span><strong>${formatNumber(med("total_counts"))}</strong></div><div><span>Median mitochondrial %</span><strong>${formatNumber(med("pct_mito"), 3)}%</strong></div>`;
    sortableTable(data.cells, [["cell_index", "Cell index"], ["x", "UMAP 1"], ["y", "UMAP 2"], ["n_genes", "n_genes"], ["total_counts", "total_counts"], ["pct_mito", "pct_mito"]], clusterCellsTable, "n_genes");
    const markerColumns = [["gene", "Gene"], ["mean_cluster", "Mean — cluster 6"], ["mean_other", "Mean — other"], ["fraction_cluster", "% expressing — cluster 6"], ["fraction_other", "% expressing — other"], ["n_expressing_cluster", "Expressing — cluster 6"], ["n_expressing_other", "Expressing — other"], ["difference", "Difference"], ["log_fold_change", "Log2 fold change"]];
    sortableTable(data.markers, markerColumns, clusterMarkersTable, "difference");
    sortableTable(data.depleted || [], markerColumns, clusterDepletedTable, "difference");
    const genes = data.markers.slice(0, 25).map((marker) => marker.gene);
    const rawByCell = new Map((data.raw_counts.cells || []).map((cell) => [cell.cell_index, cell.values]));
    Plotly.react(document.getElementById("cluster-marker-heatmap"), [{ type: "heatmap", x: data.cells.map((cell) => `Cell ${cell.cell_index}`), y: genes, z: data.cells.map((cell) => { const values = rawByCell.get(cell.cell_index) || []; return genes.map((gene) => { const index = data.raw_counts.genes.indexOf(gene); return index >= 0 ? values[index] : 0; }); }), colorscale: "Viridis", zmin: 0, colorbar: { title: "Raw counts" }, hovertemplate: "%{y}<br>%{x}<br>Raw counts: %{z}<extra></extra>" }], { margin: { l: 120, r: 30, t: 20, b: 70 }, xaxis: { title: "Cluster 6 cell" }, yaxis: { title: "Marker candidate" }, paper_bgcolor: "#fff", plot_bgcolor: "#fff" }, plotConfig);
    const comparison = await fetchJson(`/api/cluster/${encodeURIComponent(cluster)}/comparison`);
    sortableTable(comparison.cluster_values.map((row) => ({ gene: row.gene, cluster6_mean: row.cluster6_mean, highest_other_mean: row.highest_other_mean, highest_other_cluster: row.highest_other_cluster, cluster6_fraction: row.cluster6_fraction, other_fractions: Object.entries(row.fractions).filter(([key]) => key !== cluster).map(([, value]) => value).join(", ") })), [["gene", "Gene"], ["cluster6_mean", "Cluster 6 mean"], ["highest_other_mean", "Highest other mean"], ["highest_other_cluster", "Highest other cluster"], ["cluster6_fraction", "Cluster 6 fraction"], ["other_fractions", "Other fractions"]], document.getElementById("cluster-comparison-table"), "cluster6_mean");
    Plotly.react(document.getElementById("cluster-comparison-heatmap"), [{ type: "heatmap", x: comparison.heatmap.clusters.map((value) => `Cluster ${value}`), y: comparison.heatmap.genes, z: comparison.heatmap.values, colorscale: "Viridis", colorbar: { title: "Mean log-normalized expression" }, hovertemplate: "%{y}<br>%{x}<br>Mean expression: %{z}<extra></extra>" }], { margin: { l: 100, b: 55, t: 20 }, xaxis: { title: "Cluster" }, yaxis: { title: "Gene" } }, plotConfig);
    const programNames = Object.keys(comparison.program_genes);
    const rawComparison = new Map((comparison.raw_counts.cells || []).map((row) => [row.cell_index, row.values]));
    const programSummary = programNames.map((program) => {
      const genesForProgram = comparison.program_genes[program];
      const rows = comparison.cluster_values.filter((row) => genesForProgram.includes(row.gene));
      const scores = comparison.programs.map((row) => row.scores[program]);
      const otherMeans = rows.map((row) => row.means).flatMap((means) => Object.entries(means).filter(([key]) => key !== cluster).map(([, value]) => value));
      const highest = Math.max(...otherMeans, 0);
      const highestCluster = rows.flatMap((row) => Object.entries(row.means).filter(([key]) => key !== cluster).map(([key, value]) => ({ key, value }))).sort((a, b) => b.value - a.value)[0];
      return { program, genes: genesForProgram.join(", "), n_genes: genesForProgram.length, mean_score: scores.reduce((a, b) => a + b, 0) / scores.length, median_score: median(scores), n_nonzero: scores.filter((value) => value > 0).length, highest_other: highest, highest_other_cluster: highestCluster ? highestCluster.key : "—" };
    });
    sortableTable(programSummary, [["program", "Program"], ["genes", "Genes detected"], ["n_genes", "Number of genes"], ["mean_score", "Mean score"], ["median_score", "Median score"], ["n_nonzero", "Cells non-zero"], ["highest_other", "Highest other mean"], ["highest_other_cluster", "Highest other cluster"]], document.getElementById("program-summary-table"), "mean_score");
    const geneEvidence = programNames.flatMap((program) => comparison.program_genes[program].map((gene) => { const row = comparison.cluster_values.find((item) => item.gene === gene); const other = Object.entries(row.means).filter(([key]) => key !== cluster).sort((a, b) => b[1] - a[1])[0]; const otherFraction = Object.entries(row.fractions).filter(([key]) => key !== cluster).sort((a, b) => b[1] - a[1])[0]; return { program, gene, cluster6_mean: row.cluster6_mean, cluster6_fraction: row.cluster6_fraction, highest_other_mean: other[1], highest_other_cluster: other[0], highest_other_fraction: otherFraction[1] }; }));
    sortableTable(geneEvidence, [["program", "Program"], ["gene", "Gene"], ["cluster6_mean", "Cluster 6 mean"], ["cluster6_fraction", "Cluster 6 fraction"], ["highest_other_mean", "Highest other mean"], ["highest_other_cluster", "Highest other cluster"], ["highest_other_fraction", "Highest other fraction"]], document.getElementById("program-gene-table"), "cluster6_mean");
    const cellProgramRows = comparison.programs.map((row) => ({ cell_index: row.cell_index, ...row.scores }));
    sortableTable(cellProgramRows, [["cell_index", "Cell index"], ...programNames.map((name) => [name, name])], document.getElementById("cluster-program-table"), "cell_index");
    const coexpressionGenes = ["PPBP", "PF4", "GP9", "TUBB1", "RGS18", "CD3D", "CD3E", "NKG7", "GNLY", "CCL5"].filter((gene) => comparison.genes.includes(gene));
    const normalizedByCell = new Map(comparison.programs.map((row) => [row.cell_index, row]));
    const coexpressionRows = data.cells.map((cell) => { const raw = rawComparison.get(cell.cell_index) || []; const row = { cell_index: cell.cell_index }; coexpressionGenes.forEach((gene) => { const index = comparison.genes.indexOf(gene); row[`${gene}_normalized`] = comparison.cluster_values.find((item) => item.gene === gene)?.means ? "available" : "missing"; row[`${gene}_normalized_positive`] = "—"; row[`${gene}_raw_positive`] = index >= 0 && raw[index] > 0 ? "yes" : "no"; }); return row; });
    coexpressionRows.forEach((row) => { const source = comparison.raw_counts.cells.find((item) => item.cell_index === row.cell_index); coexpressionGenes.forEach((gene) => { const index = comparison.genes.indexOf(gene); const normalized = comparison.genes.includes(gene) ? (comparison.cluster_values.find((item) => item.gene === gene)?.cluster6_fraction || 0) : 0; row[`${gene}_normalized_positive`] = normalized > 0 ? "see heatmap" : "no"; }); });
    const coexpressionColumns = [["cell_index", "Cell index"], ...coexpressionGenes.flatMap((gene) => [[`${gene}_normalized_positive`, `${gene} norm > 0`], [`${gene}_raw_positive`, `${gene} raw > 0`]])];
    sortableTable(coexpressionRows, coexpressionColumns, document.getElementById("cluster-coexpression-table"), "cell_index");
    Plotly.react(document.getElementById("cluster-program-heatmap"), [{ type: "heatmap", x: programNames, y: comparison.programs.map((row) => `Cell ${row.cell_index}`), z: comparison.programs.map((row) => programNames.map((name) => row.scores[name])), colorscale: "Viridis", colorbar: { title: "Mean expression" }, hovertemplate: "%{y}<br>%{x}<br>Score: %{z}<extra></extra>" }], { margin: { l: 90, b: 80, t: 20 }, xaxis: { title: "Expression program" }, yaxis: { title: "Cluster 6 cell" } }, plotConfig);
    const comparisonRaw = new Map((comparison.raw_counts.cells || []).map((row) => [row.cell_index, row.values]));
    Plotly.react(document.getElementById("cluster-comparison-cell-heatmap"), [{ type: "heatmap", x: comparison.genes, y: data.cells.map((cell) => `Cell ${cell.cell_index}`), z: data.cells.map((cell) => comparison.genes.map((gene, index) => { const row = comparisonRaw.get(cell.cell_index) || []; return row[index] || 0; })), colorscale: "Viridis", zmin: 0, colorbar: { title: "Raw counts" }, hovertemplate: "%{y}<br>%{x}<br>Raw counts: %{z}<extra></extra>" }], { margin: { l: 90, b: 100, t: 20 }, xaxis: { title: "Comparison gene" }, yaxis: { title: "Cluster 6 cell" } }, plotConfig);
  } catch (error) { showError(error.message || "Unable to load cluster 6 analysis."); }
}

function updateClusterView() {
  const selectedCluster = clusterSelect.value;
  clusterAnalysis.hidden = selectedCluster !== "6";
  const indices = clusterData.clusters.map((cluster, index) => cluster === selectedCluster ? index : -1).filter((index) => index >= 0);
  const genes = indices.map((index) => clusterData.n_genes[index]);
  const counts = indices.map((index) => clusterData.total_counts[index]);
  const mito = indices.map((index) => clusterData.pct_mito[index]);
  clusterCellCount.textContent = indices.length;
  clusterMedianGenes.textContent = median(genes).toLocaleString(undefined, { maximumFractionDigits: 2 });
  clusterMedianCounts.textContent = median(counts).toLocaleString(undefined, { maximumFractionDigits: 2 });
  clusterMedianMito.textContent = `${median(mito).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`;
  selection.textContent = `cluster ${selectedCluster}`;
  renderClusterUmap(selectedCluster);
  const valuesByCluster = (field) => [...new Set(clusterData.clusters)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((cluster) => ({
    cluster,
    values: clusterData[field].filter((_, index) => clusterData.clusters[index] === cluster),
  }));
  renderQcPlot("qc-genes", valuesByCluster("n_genes"), "Genes per cell", "Genes per cell");
  renderQcPlot("qc-counts", valuesByCluster("total_counts"), "Total counts per cell", "Total counts per cell");
  renderQcPlot("qc-mito", valuesByCluster("pct_mito"), "Mitochondrial fraction (%)", "Mitochondrial fraction (%)");
  loadClusterAnalysis(selectedCluster);
}

async function showGeneExpression(event) {
  event.preventDefault();
  const gene = geneInput.value.trim();
  clearError();
  if (!gene) { showError("Enter a gene name before requesting expression."); geneInput.focus(); return; }
  loadingState.hidden = false;
  loadingState.textContent = `Loading ${gene} expression…`;
  try {
    const result = await fetchJson(`/api/gene/${encodeURIComponent(gene)}`);
    if (result.n_cells !== umapData.n_cells || !Array.isArray(result.expression) || result.expression.length !== umapData.coordinates.length) throw new Error("The gene-expression response does not match the UMAP cell count.");
    if (!result.expression.every((value) => typeof value === "number" && Number.isFinite(value))) throw new Error("The gene-expression response contains invalid values.");
    renderUmap(result.expression, result.gene);
    selection.textContent = result.gene;
    loadingState.textContent = `${result.gene} expression loaded`;
  } catch (error) { showError(error.message || "Unable to load gene expression."); loadingState.textContent = `${umapData.n_cells.toLocaleString()} cells loaded`; }
}

function setMode() {
  const clusterMode = modeSelect.value === "cluster";
  geneForm.hidden = clusterMode;
  clusterControls.hidden = !clusterMode;
  clusterSummary.hidden = !clusterMode;
  qcSection.hidden = !clusterMode;
  clearError();
  if (clusterMode) updateClusterView();
  else { renderUmap(); selection.textContent = "none"; loadingState.textContent = `${umapData.n_cells.toLocaleString()} cells loaded`; }
}

async function initialise() {
  try {
    const { health, clusters } = await loadDatasetInfo();
    clusterData = clusters;
    cellCount.textContent = health.n_cells;
    geneCount.textContent = health.n_genes;
    const availableClusters = [...new Set(clusterData.clusters)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    availableClusters.forEach((cluster, index) => {
      clusterColorMap.set(cluster, clusterColors[index % clusterColors.length]);
      const option = document.createElement("option");
      option.value = cluster;
      option.textContent = cluster;
      clusterSelect.appendChild(option);
    });
    renderUmap();
    loadingState.textContent = `${umapData.n_cells.toLocaleString()} cells loaded`;
  } catch (error) { showError(error.message || "Unable to load the dataset."); loadingState.hidden = true; }
}

geneForm.addEventListener("submit", showGeneExpression);
geneInput.addEventListener("input", updateGeneSuggestions);
geneInput.addEventListener("focus", updateGeneSuggestions);
geneInput.addEventListener("keydown", (event) => { if (event.key === "Escape") hideGeneSuggestions(); });
document.addEventListener("click", (event) => { if (!geneInput.contains(event.target) && !geneSuggestions.contains(event.target)) hideGeneSuggestions(); });
modeSelect.addEventListener("change", setMode);
clusterSelect.addEventListener("change", updateClusterView);
initialise();

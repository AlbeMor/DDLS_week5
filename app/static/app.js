const plotElement = document.getElementById("umap-plot");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const cellCount = document.getElementById("cell-count");
const geneCount = document.getElementById("gene-count");

function showError(message) {
  loadingState.hidden = true;
  errorState.textContent = message;
  errorState.hidden = false;
}

async function loadDatasetInfo() {
  const [umapResponse, healthResponse] = await Promise.all([
    fetch("/api/umap"),
    fetch("/api/health"),
  ]);

  if (!umapResponse.ok) {
    throw new Error(`Unable to load UMAP data (HTTP ${umapResponse.status}).`);
  }
  if (!healthResponse.ok) {
    throw new Error(`Unable to load dataset information (HTTP ${healthResponse.status}).`);
  }

  return {
    umap: await umapResponse.json(),
    health: await healthResponse.json(),
  };
}

function renderUmap(umap) {
  const x = umap.coordinates.map((point) => point.x);
  const y = umap.coordinates.map((point) => point.y);
  const cellIndices = umap.coordinates.map((_, index) => index);

  Plotly.newPlot(plotElement, [{
    x,
    y,
    mode: "markers",
    type: "scattergl",
    marker: { size: 7, color: "#176b87", opacity: 0.78 },
    text: cellIndices.map((index) => `Cell index: ${index}`),
    customdata: cellIndices,
    hovertemplate: "Cell index: %{customdata}<br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>",
  }], {
    margin: { l: 58, r: 24, t: 18, b: 52 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    hovermode: "closest",
    xaxis: { title: "UMAP 1", zeroline: false, showgrid: true, gridcolor: "#e2e9ed" },
    yaxis: { title: "UMAP 2", zeroline: false, showgrid: true, gridcolor: "#e2e9ed" },
    dragmode: "pan",
  }, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["select2d", "lasso2d"],
  });
}

async function initialise() {
  try {
    const { umap, health } = await loadDatasetInfo();
    cellCount.textContent = health.n_cells;
    geneCount.textContent = health.n_genes;
    renderUmap(umap);
    loadingState.textContent = `${umap.n_cells.toLocaleString()} cells loaded`;
  } catch (error) {
    showError(error.message || "Unable to load the dataset.");
  }
}

initialise();

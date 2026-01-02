// --- CONFIGURATION ---
const config = {
  colors: {
    0: '#2c3e50', // Nul (Gris bleu sombre)
    1: '#2ecc71', // Faible (Vert)
    2: '#f1c40f', // Moyen (Jaune)
    3: '#e67e22', // Fort (Orange)
    4: '#c0392b'  // Très Fort (Rouge sang)
  },
  labels: {
    0: 'Nul', 1: 'Faible', 2: 'Moyen', 3: 'Fort', 4: 'Très Fort'
  }
};

// --- INIT CARTE (Dark Mode) ---
const map = L.map('map', { zoomControl: false }).setView([47.9, 7.35], 10);

// Fond de carte sombre pour faire ressortir le feu (CartoDB DarkMatter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap, © CartoDB'
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

// Variables globales
let geoJsonLayer;
let rawData;
let myChart;

// --- FONCTIONS ---

function getColor(dn) {
  return config.colors[dn] || '#ccc';
}

function style(feature) {
  return {
    fillColor: getColor(feature.properties.DN),
    weight: 0, // Pas de bordure pour alléger
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.75
  };
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.95 });
  layer.bringToFront();
}

function resetHighlight(e) {
  geoJsonLayer.resetStyle(e.target);
}

// --- CHARGEMENT DES DONNÉES ---
fetch('data_vegetation.geojson') // Assure-toi que le fichier est à côté du HTML
  .then(res => res.json())
  .then(data => {
    rawData = data;
    initDashboard(data);
  })
  .catch(err => console.error("Erreur chargement:", err));

function initDashboard(data) {
  // 1. AJOUT CARTE
  geoJsonLayer = L.geoJSON(data, {
    style: style,
    onEachFeature: (feature, layer) => {
      // Infobulle propre
      const surfHa = (feature.properties.surf / 10000).toFixed(1); // m² -> Hectares
      const niv = config.labels[feature.properties.DN];
      
      layer.bindPopup(`
        <div style="font-family:'Inter'">
          <h4 style="margin:0 0 5px 0; color:${getColor(feature.properties.DN)}">Niveau ${niv}</h4>
          <b>Surface :</b> ${surfHa} ha<br>
          <small>ID: ${feature.properties.fid}</small>
        </div>
      `);
      
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
      });
    }
  }).addTo(map);

  map.fitBounds(geoJsonLayer.getBounds());

  // 2. CALCUL DES STATISTIQUES
  const stats = calculateStats(data);
  
  // 3. MISE À JOUR KPI
  updateKPI(stats);

  // 4. CRÉATION GRAPHIQUE
  createChart(stats);

  // 5. CRÉATION FILTRES
  createFilters();
}

// Calcul agrégé des surfaces par niveau
function calculateStats(data) {
  const counts = { 0:0, 1:0, 2:0, 3:0, 4:0 };
  
  data.features.forEach(f => {
    const dn = f.properties.DN;
    const surf = f.properties.surf || 0;
    if (counts[dn] !== undefined) {
      counts[dn] += surf;
    }
  });

  // Conversion en Hectares
  for (let key in counts) {
    counts[key] = (counts[key] / 10000).toFixed(0); 
  }
  return counts;
}

function updateKPI(stats) {
  // Surface Risque Fort (3) + Très Fort (4)
  const highRiskSurf = parseInt(stats[3]) + parseInt(stats[4]);
  document.getElementById('kpi-surface').innerText = highRiskSurf.toLocaleString() + ' ha';
  
  // Nombre de zones très fortes (juste un comptage simple des polygones)
  const criticalZones = rawData.features.filter(f => f.properties.DN === 4).length;
  document.getElementById('kpi-count').innerText = criticalZones;
}

function createChart(stats) {
  const ctx = document.getElementById('riskChart').getContext('2d');
  
  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.values(config.labels),
      datasets: [{
        data: Object.values(stats),
        backgroundColor: Object.values(config.colors),
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // On cache la légende par défaut du chart
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} ha`
          }
        }
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          filterMap(index); // Interaction Chart -> Map
        } else {
          filterMap('all');
        }
      }
    }
  });
}

function createFilters() {
  const container = document.getElementById('filter-container');
  
  // Bouton "Tous"
  container.innerHTML = `<button class="filter-btn active" onclick="filterMap('all')">Tous</button>`;

  // Boutons par niveau
  Object.keys(config.labels).forEach(key => {
    const label = config.labels[key];
    const color = config.colors[key];
    container.innerHTML += `
      <button class="filter-btn" onclick="filterMap(${key})" id="btn-${key}">
        <span class="dot" style="background:${color}"></span> ${label}
      </button>
    `;
  });
}

// Logique de filtrage (Synchronisée)
window.filterMap = function(level) {
  // 1. Update Map
  geoJsonLayer.eachLayer(layer => {
    const dn = layer.feature.properties.DN;
    if (level === 'all' || dn == level) {
      layer.setStyle({ opacity: 1, fillOpacity: 0.75 });
    } else {
      layer.setStyle({ opacity: 0, fillOpacity: 0 }); // Masquer
    }
  });

  // 2. Update UI Buttons
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (level === 'all') {
    document.querySelector('.filter-btn').classList.add('active');
  } else {
    document.getElementById(`btn-${level}`).classList.add('active');
  }
};
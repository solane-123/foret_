// --- CONFIGURATION ---
const config = {
    colors: ['#10b981', '#a3e635', '#facc15', '#fb923c', '#ef4444'], 
    heightFactor: 400 
};

// --- INIT CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [7.35, 47.9], // Centré sur le Haut-Rhin
    zoom: 9,
    pitch: 50,
    bearing: -10,
    antialias: true
});

map.on('load', () => {
    // 1. Vérifie que data.js est bien chargé
    if (typeof forestData === 'undefined') {
        alert("ERREUR : Le fichier data.js n'est pas trouvé !");
        return;
    }

    // --- NOUVEAU : 2. AJOUT DU FOND SATELLITE (Flux Externe) ---
    map.addSource('satellite-source', {
        'type': 'raster',
        'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        'tileSize': 256
    });

    map.addLayer({
        'id': 'satellite-layer',
        'type': 'raster',
        'source': 'satellite-source',
        'paint': { 'raster-opacity': 0 }, // Invisible au départ
        'layout': { 'visibility': 'visible' }
    });

    // --- NOUVEAU : 3. AJOUT DES COMMUNES (API Géo en direct) ---
    fetch('https://geo.api.gouv.fr/departements/68/communes?geometry=contour&format=geojson&type=commune-actuelle')
        .then(res => res.json())
        .then(communesData => {
            map.addSource('communes-source', { type: 'geojson', data: communesData });
            
            // Les lignes des communes
            map.addLayer({
                'id': 'communes-lines',
                'type': 'line',
                'source': 'communes-source',
                'layout': { 'visibility': 'none' }, // Invisible au départ
                'paint': {
                    'line-color': '#ffffff',
                    'line-width': 1,
                    'line-opacity': 0.5,
                    'line-dasharray': [2, 1]
                }
            });
            
            // Les noms des communes
            map.addLayer({
                'id': 'communes-labels',
                'type': 'symbol',
                'source': 'communes-source',
                'layout': {
                    'text-field': ['get', 'nom'],
                    'text-font': ['Open Sans Regular'], // Police par défaut
                    'text-size': 12,
                    'visibility': 'none'
                },
                'paint': {
                    'text-color': '#fff',
                    'text-halo-color': '#000',
                    'text-halo-width': 2
                }
            });
        })
        .catch(err => console.error("Erreur chargement communes", err));


    // --- 4. TA COUCHE FORÊT (Données data.js) ---
    map.addSource('foret', {
        type: 'geojson',
        data: forestData
    });

    map.addLayer({
        'id': 'foret-3d',
        'type': 'fill-extrusion',
        'source': 'foret',
        'paint': {
            'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'DN'],
                0, config.colors[0],
                1, config.colors[1],
                2, config.colors[2],
                3, config.colors[3],
                4, config.colors[4]
            ],
            'fill-extrusion-height': [
                'interpolate', ['linear'], ['get', 'DN'],
                0, 20,    
                4, 3000   
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9
        }
    });

    // 5. Zoom automatique sur les données
    const bounds = new maplibregl.LngLatBounds();
    forestData.features.forEach(feature => {
        const geometry = feature.geometry;
        if (geometry.type === 'Polygon') {
            geometry.coordinates[0].forEach(coord => bounds.extend(coord));
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(poly => {
                poly[0].forEach(coord => bounds.extend(coord));
            });
        }
    });
    
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, pitch: 45 });
    }

    // 6. Interaction (Popup)
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mousemove', 'foret-3d', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        const surfHa = (props.surf / 10000).toFixed(1);
        
        popup.setLngLat(e.lngLat)
            .setHTML(`
                <div style="color:#333; font-family:'Outfit'; padding:5px;">
                    <strong style="font-size:1.1em; color:${config.colors[props.DN]}">Niveau ${props.DN}</strong><br>
                    Surface: ${surfHa} ha
                </div>
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'foret-3d', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    // 7. Calculs Indicateurs
    processData(forestData);
});

// --- FONCTIONS EXISTANTES (Indicateurs & Graphiques) ---
function processData(data) {
    let totalSurf = 0;
    let weightedRiskSum = 0; 
    let highRiskSurf = 0;
    let distribution = [0, 0, 0, 0, 0];

    data.features.forEach(f => {
        const dn = f.properties.DN;
        const surf = f.properties.surf; 
        
        totalSurf += surf;
        weightedRiskSum += (surf * dn); 
        
        if(dn >= 3) { highRiskSurf += surf; }
        if(distribution[dn] !== undefined) { distribution[dn] += surf; }
    });

    document.getElementById('kpi-surf').innerText = (highRiskSurf / 10000).toFixed(0).toLocaleString();
    
    const ivm = (weightedRiskSum / totalSurf).toFixed(2);
    const kpiZonesLabel = document.querySelector('.kpi-card.warning .label');
    const kpiZonesValue = document.getElementById('kpi-zones');
    const kpiZonesUnit = document.querySelector('.kpi-card.warning .unit');

    kpiZonesLabel.innerText = "Indice Global (IVM)";
    kpiZonesValue.innerText = ivm + "/4";
    kpiZonesUnit.innerText = "Vulnérabilité Moyenne";

    if(ivm < 1.5) kpiZonesValue.style.color = "#a3e635"; 
    else if(ivm < 2.5) kpiZonesValue.style.color = "#facc15"; 
    else kpiZonesValue.style.color = "#ef4444"; 

    createChart(distribution, ivm);
}

function createChart(data, ivm) {
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(d => ((d / total) * 100).toFixed(1));

    const ctx = document.getElementById('riskChart').getContext('2d');
    if(window.myRiskChart) window.myRiskChart.destroy();

    window.myRiskChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Nul (0)', 'Faible (1)', 'Moyen (2)', 'Fort (3)', 'Critique (4)'],
            datasets: [{
                label: 'Part du territoire (%)',
                data: percentages,
                backgroundColor: config.colors,
                borderRadius: 4,
                borderWidth: 0,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => ` ${c.raw}% du territoire` } }
            },
            scales: {
                x: { 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.5)', callback: (v) => v + '%' }
                },
                y: { 
                    grid: { display: false },
                    ticks: { color: '#fff', font: {family: 'Outfit'} } 
                }
            }
        }
    });
}

// --- NOUVEAU : FONCTION POUR LES BOUTONS ---
// Cette fonction est en dehors de map.on('load') pour être accessible par le HTML
window.toggleLayer = function(layerName) {
    // Gestion du bouton actif (visuel)
    const btn = event.currentTarget;
    btn.classList.toggle('active');

    if (layerName === 'satellite') {
        const currentOpacity = map.getPaintProperty('satellite-layer', 'raster-opacity');
        // Si c'est 1 (visible), on passe à 0 (invisible), et inversement
        const targetOpacity = currentOpacity === 1 ? 0 : 1;
        map.setPaintProperty('satellite-layer', 'raster-opacity', targetOpacity);
    } 
    else if (layerName === 'communes') {
        const visibility = map.getLayoutProperty('communes-lines', 'visibility');
        const nextState = (visibility === 'visible') ? 'none' : 'visible';
        
        map.setLayoutProperty('communes-lines', 'visibility', nextState);
        map.setLayoutProperty('communes-labels', 'visibility', nextState);
    }
};
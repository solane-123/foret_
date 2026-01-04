// --- CONFIGURATION PREMIUM ---
const config = {
    colors: ['#059669', '#34d399', '#facc15', '#fb923c', '#ef4444'], 
    labels: ['Nul', 'Faible', 'Moyen', 'Fort', 'Critique'],
    heightFactor: 400 
};

// --- INIT CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [7.35, 47.9],
    zoom: 9, pitch: 55, bearing: -15, antialias: true
});

map.on('load', () => {
    if (typeof forestData === 'undefined') { alert("ERREUR: Le fichier data.js n'est pas chargé. Vérifie qu'il est bien dans le dossier."); return; }

    // 1. Satellite
    map.addSource('satellite-source', { 'type': 'raster', 'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 'tileSize': 256 });
    map.addLayer({ 'id': 'satellite-layer', 'type': 'raster', 'source': 'satellite-source', 'paint': { 'raster-opacity': 0 }, 'layout': { 'visibility': 'visible' } });

    // 2. Communes (API)
    fetch('https://geo.api.gouv.fr/departements/68/communes?geometry=contour&format=geojson&type=commune-actuelle')
        .then(res => res.json())
        .then(d => {
            map.addSource('communes-source', { type: 'geojson', data: d });
            map.addLayer({ 'id': 'communes-lines', 'type': 'line', 'source': 'communes-source', 'layout': { 'visibility': 'none' }, 'paint': { 'line-color': '#a7f3d0', 'line-width': 0.8, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } });
            map.addLayer({ 'id': 'communes-labels', 'type': 'symbol', 'source': 'communes-source', 'layout': { 'text-field': ['get', 'nom'], 'text-font': ['Open Sans SemiBold'], 'text-size': 11, 'visibility': 'none', 'text-transform': 'uppercase' }, 'paint': { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(15, 23, 42, 0.8)', 'text-halo-width': 2 } });
        });

    // 3. Forêt 3D
    map.addSource('foret', { type: 'geojson', data: forestData });
    map.addLayer({
        'id': 'foret-3d', 'type': 'fill-extrusion', 'source': 'foret',
        'paint': {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'DN'], 0, config.colors[0], 1, config.colors[1], 2, config.colors[2], 3, config.colors[3], 4, config.colors[4]],
            'fill-extrusion-height': ['interpolate', ['linear'], ['get', 'DN'], 0, 30, 4, 3500],
            'fill-extrusion-opacity': 0.95
        }
    });

    // 4. Auto-Zoom
    const bounds = new maplibregl.LngLatBounds();
    forestData.features.forEach(f => { const g = f.geometry; (g.type==='Polygon'?g.coordinates[0]:g.coordinates.flat(1)).forEach(c => bounds.extend(c)); });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: {top: 50, bottom:50, left: 450, right: 50}, pitch: 55 });

    // 5. Popup
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px' });
    map.on('mousemove', 'foret-3d', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        const color = config.colors[p.DN];
        popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:'Outfit';">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                    <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${color}; box-shadow: 0 0 10px ${color};"></span>
                    <strong style="font-size:1.1em; color:#fff;">Niveau ${p.DN}</strong>
                </div>
                <div style="color:#94a3b8; font-size:0.9em;">Surface: <span style="color:#fff; font-weight:600;">${(p.surf/10000).toFixed(1)} ha</span></div>
            </div>
        `).addTo(map);
    });
    map.on('mouseleave', 'foret-3d', () => { map.getCanvas().style.cursor = ''; popup.remove(); });

    processData(forestData);
});

function processData(data) {
    let total=0, weighted=0, high=0, dist=[0,0,0,0,0];
    data.features.forEach(f => {
        const s = f.properties.surf, d = f.properties.DN;
        total+=s; weighted+=(s*d);
        if(d>=3) high+=s;
        if(dist[d]!==undefined) dist[d]+=s;
    });

    // Mise à jour KPIs
    document.getElementById('kpi-surf').innerText = (high/10000).toFixed(0).toLocaleString();
    const ivm = (weighted/total).toFixed(2);
    const kpiVal = document.getElementById('kpi-zones');
    kpiVal.innerText = ivm + "/4";
    kpiVal.style.color = ivm<1.5 ? config.colors[1] : (ivm<2.5 ? config.colors[2] : config.colors[4]);

    // Appel des 2 graphiques
    createBarChart(dist);
    createPolarChart(dist);
}

function createBarChart(data) {
    const total = data.reduce((a,b)=>a+b,0); const perc = data.map(d=>((d/total)*100).toFixed(1));
    const ctx = document.getElementById('riskChart').getContext('2d');
    if(window.barChart) window.barChart.destroy();
    
    Chart.defaults.font.family = 'Outfit';
    window.barChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: config.labels, datasets: [{ data: perc, backgroundColor: config.colors, borderRadius: 6, barPercentage: 0.7 }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: {display:false}, tooltip: {backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#e2e8f0', callbacks: {label:c=>` ${c.raw}%`}}},
            scales: { x: { grid: {color: 'rgba(255,255,255,0.05)'}, ticks: {color:'#94a3b8', callback:v=>v+'%'} }, y: { grid: {display:false}, ticks: {color: '#e2e8f0'} } }
        }
    });
}

function createPolarChart(data) {
    // Conversion des données en pourcentages
    const total = data.reduce((a,b)=>a+b,0); 
    const perc = data.map(d=>((d/total)*100).toFixed(1));
    
    const ctx = document.getElementById('polarChart').getContext('2d');
    if(window.polarChart) window.polarChart.destroy();
    
    window.polarChart = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: config.labels,
            datasets: [{
                data: perc,
                backgroundColor: config.colors.map(c => c + 'AA'), // Transparence
                borderColor: config.colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: {display:false}, tooltip: {backgroundColor: '#0f172a', bodyColor: '#fff'} },
            scales: { r: { grid: {color: 'rgba(255,255,255,0.1)'}, ticks: {display: false, backdropColor: 'transparent'}, pointLabels: {color: '#e2e8f0', font:{size:11}} } }
        }
    });
}

window.toggleLayer = function(n) {
    event.currentTarget.classList.toggle('active');
    if(n==='satellite') {
        const op = map.getPaintProperty('satellite-layer', 'raster-opacity');
        map.setPaintProperty('satellite-layer', 'raster-opacity', op===1?0:1);
    } else {
        const v = map.getLayoutProperty('communes-lines','visibility')==='visible'?'none':'visible';
        map.setLayoutProperty('communes-lines','visibility',v); map.setLayoutProperty('communes-labels','visibility',v);
    }
};
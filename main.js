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
        alert("ERREUR : Le fichier data.js n'est pas trouvé !\n\nVérifie que tu as bien créé le fichier 'data.js' en ajoutant 'const forestData = ' au début.");
        return;
    }

    console.log("Données chargées :", forestData);

    // 2. Ajout de la source de données
    map.addSource('foret', {
        type: 'geojson',
        data: forestData
    });

    // 3. Ajout de la couche 3D
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
                0, 20,    // Niveau 0 : bas
                4, 3000   // Niveau 4 : très haut
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9
        }
    });

    // 4. Zoom automatique sur les données
    const bounds = new maplibregl.LngLatBounds();
    forestData.features.forEach(feature => {
        // Gère les polygones simples et multiples
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

    // 5. Interaction (Popup au survol)
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mousemove', 'foret-3d', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        const surfHa = (props.surf / 10000).toFixed(1);
        
        popup.setLngLat(e.lngLat)
            .setHTML(`
                <div style="color:#333; font-family:'Outfit'; padding:5px;">
                    <strong style="font-size:1.1em;">Niveau ${props.DN}</strong><br>
                    Surface: ${surfHa} ha
                </div>
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'foret-3d', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    // 6. Calculs pour le panneau latéral
    processData(forestData);
});

function processData(data) {
    let totalSurf = 0;
    let highRiskZones = 0;
    let distribution = [0, 0, 0, 0, 0];

    data.features.forEach(f => {
        const dn = f.properties.DN;
        const surf = f.properties.surf;
        
        if(dn >= 3) { 
            totalSurf += surf; 
            highRiskZones++; 
        }
        if(distribution[dn] !== undefined) { 
            distribution[dn] += surf; 
        }
    });

    document.getElementById('kpi-surf').innerText = (totalSurf / 10000).toFixed(0).toLocaleString();
    document.getElementById('kpi-zones').innerText = highRiskZones;
    createChart(distribution);
}

function createChart(data) {
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(d => ((d / total) * 100).toFixed(1));

    const ctx = document.getElementById('riskChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Nul', 'Faible', 'Moyen', 'Fort', 'T.Fort'],
            datasets: [{
                data: percentages,
                backgroundColor: config.colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => ` ${c.raw}%` } }
            }
        }
    });
}
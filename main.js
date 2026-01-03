// --- CONFIGURATION ---
const config = {
    colors: ['#10b981', '#a3e635', '#facc15', '#fb923c', '#ef4444'], // Vert -> Rouge
    heightFactor: 400 
};

// --- INITIALISATION DE LA CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [7.35, 47.9], // Haut-Rhin (approximatif pour le départ)
    zoom: 9,
    pitch: 50,
    bearing: -10,
    antialias: true
});

map.on('load', () => {
    // 1. Vérification des données
    if (typeof forestData === 'undefined') {
        alert("ERREUR : Le fichier data.js n'est pas chargé !");
        return;
    }

    console.log("Données brutes reçues (Lambert 93)... Conversion en cours...");

    // 2. CONVERSION MAGIQUE (Lambert 93 -> WGS84)
    // On définit ce qu'est le Lambert 93 pour le navigateur
    proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
    
    // On convertit les données
    const convertedData = reproject.toWgs84(forestData, "EPSG:2154", proj4);
    
    console.log("Données converties (GPS) :", convertedData);

    // 3. LANCEMENT DE L'APP AVEC LES DONNÉES CONVERTIES
    initApp(convertedData);

    // 4. AUTO-ZOOM SUR LES DONNÉES
    const bounds = new maplibregl.LngLatBounds();
    convertedData.features.forEach(feature => {
        // Gestion robuste Polygon / MultiPolygon
        const coords = feature.geometry.type === 'MultiPolygon' 
            ? feature.geometry.coordinates.flat(1) 
            : feature.geometry.coordinates;
            
        coords.forEach(poly => {
            poly.forEach(coord => {
                bounds.extend(coord);
            });
        });
    });
    
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, pitch: 45 });
    }
});

function initApp(data) {
    // Ajout de la source
    map.addSource('foret', { type: 'geojson', data: data });

    // Ajout de la couche 3D
    map.addLayer({
        'id': 'foret-3d',
        'type': 'fill-extrusion',
        'source': 'foret',
        'paint': {
            // Couleur basée sur la colonne "DN" (0 à 4)
            'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'DN'],
                0, config.colors[0],
                1, config.colors[1],
                2, config.colors[2],
                3, config.colors[3],
                4, config.colors[4]
            ],
            // Hauteur basée sur DN
            'fill-extrusion-height': [
                'interpolate', ['linear'], ['get', 'DN'],
                0, 50,    // Niveau 0 : 50m de haut
                4, 3000   // Niveau 4 : 3000m de haut (très visible)
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9
        }
    });

    // Interaction (Popups)
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mousemove', 'foret-3d', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        // La colonne s'appelle "surf", on la divise par 10000 pour avoir des hectares
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

    // Calculs pour les graphiques
    processData(data);
}

function processData(data) {
    let totalSurf = 0;
    let highRiskZones = 0;
    let distribution = [0, 0, 0, 0, 0];

    data.features.forEach(f => {
        const dn = f.properties.DN;
        const surf = f.properties.surf; // Utilisation de la colonne 'surf'
        
        if(dn >= 3) { totalSurf += surf; highRiskZones++; }
        if(distribution[dn] !== undefined) { distribution[dn] += surf; }
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
        type: 'doughnut', // Changé en Doughnut pour le style
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
                tooltip: { 
                    callbacks: { label: (c) => ` ${c.raw}% des surfaces` } 
                }
            }
        }
    });
}
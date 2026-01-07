**Observatoire des Enjeux Forestiers (68)**
Contexte du projet : Ce prototype a été réalisé dans le cadre d'un exercice de mise en situation pour le recrutement d'un chargé de mission "Enjeux Forestiers". L'objectif est de démontrer une capacité à valoriser une donnée brute (Open Data) via une interface cartographique interactive d'aide à la décision.

**Vue d'ensemble**
L'Observatoire des Enjeux Forestiers est une plateforme de géovisualisation (WebSIG) conçue pour analyser la vulnérabilité du couvert végétal face au risque incendie dans le département du Haut-Rhin.

En croisant les données de sensibilité écologique avec le découpage administratif, cet outil offre aux décideurs publics (Maires, EPCI, Préfecture) et aux services de lutte (SDIS) une lecture immédiate des zones critiques pour adapter les politiques de prévention.

**Objectifs**
Valorisation de la Donnée Publique : Transformer un jeu de données complexe (niveau de sensibilité DN) en une information visuelle intelligible.

Aide à la Décision (Urbanisme) : Identifier les communes où la pression du risque nécessite une adaptation des documents d'urbanisme (PLU) et un renforcement des Obligations Légales de Débroussaillement (OLD).

Pédagogie du Risque : Fournir des supports visuels (Radar, 3D) pour développer la culture du risque auprès des élus et des citoyens.

**Caractéristiques Techniques**
**1. Visualisation 3D Inversée (Smart Mapping)**
Pour maximiser la lisibilité des zones à risque, l'application utilise une projection 3D inversée :

**Méthodologie :** L'axe Z (Hauteur) est corrélé inversement à la gravité du risque.

**Rendu :** Les zones Critiques (Rouges) sont ancrées au sol (les "fondations" du risque), tandis que les zones à risque faible flottent en hauteur. Cela permet de voir immédiatement les zones rouges sans qu'elles soient masquées par des polygones moins importants au premier plan.

**2. Analyse Territoriale Dynamique (Client-Side Processing)**
L'application ne se contente pas d'afficher des couches, elle les croise en temps réel :

Découpage Géographique : Utilisation de la librairie Turf.js pour calculer en direct l'intersection géométrique entre les forêts et les limites communales (API Géo).

Mise à jour des KPI : Recalcul instantané des surfaces et de l'Indice de Vulnérabilité Moyen (IVM) selon le périmètre sélectionné (Département ou Commune).

**3. Tableaux de Bord Statistiques**
Chaque sélection territoriale génère des graphiques d'analyse (via Chart.js) :

Profil Radar : "Signature" du risque de la commune (permet de voir si la vulnérabilité est structurelle).

Répartition Surfacique : Histogramme des volumes d'hectares par classe de risque.

**Données et Méthodologie**
Les données utilisées sont issues de sources ouvertes officielles et traitées pour garantir leur intégrité :

Sensibilité aux feux de forêt (DataGrandEst) :

Exploitation du champ DN (Digital Number) de 0 à 4.

Donnée composite intégrant la combustibilité de la végétation, l'hygrométrie et la pente.

Référentiel Administratif (API Géo - Etalab) :

Récupération dynamique des contours communaux du Haut-Rhin (Code 68).

Indice IVM (Indice de Vulnérabilité Moyen) :

Indicateur synthétique calculé par l'application : moyenne pondérée des niveaux de risque par rapport à la surface visible.

**Stack Technique**
Le projet est conçu comme une Single Page Application (SPA) légère, sans backend lourd, pour une portabilité maximale :

Cartographie : MapLibre GL JS

Analyse Spatiale : Turf.js

Dataviz : Chart.js

Interface : HTML5 / CSS3 (Design System inspiré de la charte DataGrandEst).

Réalisé en Janvier 2026 MERCIER Solane - Exercice de recrutement.

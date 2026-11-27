# Earth Zoom
16-second continuous spherical camera flight from Arabian Peninsula to Pampanga, with oblique approach. 24 fps production: 384 frames.
Run npm run dev and open /earth/, or npm run render:realtime -- --scene earth.
Beauty: PNG. Motion vectors: signed RGB float32 TIFF (R = rightward pixels/frame, G = downward pixels/frame, B = validity); opaque Earth surface only. No depth pass.
No DOF. Text and outline are baked beauty overlays, excluded from motion vectors.
Satellite imagery is historical; no live imagery or elevation reconstruction.
Sources:
- earth-consistent.jpg, region-consistent.jpg, luzon-consistent.jpg: NASA GIBS BlueMarble_ShadedRelief_Bathymetry, common source and color treatment; bounds respectively (-180,-90,180,90), (105,3,140,30), (117,12,124,18).
- Regional satellite previews: Esri World Imagery (Esri, Maxar, Earthstar Geographics and GIS user community), EPSG:4326. Bounds: region 105,3,140,30; Luzon 117,12,124,18; Pampanga 119,13.8,122.3,16.6. Confirm imagery usage and redistribution rights before publication; these assets are local evaluation copies. Old striped Landsat composite is not used.
- pampanga.geojson: geoBoundaries PHL ADM2, gbOpen, simplified Pampanga feature. CC BY 3.0 IGO; https://www.geoboundaries.org/

Cloud opacity texture: https://github.com/turban/webgl-earth/blob/master/images/fair_clouds_4k.png, 4096x2048 RGBA cloud map on elevated 8.5 km spherical shell. Uses alpha channel, animated drift, and reduced opacity over Pampanga. Beauty only, excluded from motion vectors. Static cloud pattern, not live weather. Verify source asset usage rights before publication.

Local imagery setup: the JPEGs and clouds-fair.png are intentionally not tracked in Git pending redistribution review. The current laptop already has them. Restore the authorized local files earth-consistent.jpg, region-satellite.jpg, luzon-satellite.jpg, pampanga-satellite.jpg and clouds-fair.png into earth/public before running the Earth scene on a new machine.

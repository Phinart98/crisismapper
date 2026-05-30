# Building-footprint ingest (Overture Maps → PostGIS)

Phase 7 renders building footprints from the PostGIS `buildings` table (Webinar
Q&A #13: "we strongly recommend using open, publicly available datasets").
Overture Maps merges Google Open Buildings + Microsoft + OSM — open, keyless,
served from a public AWS S3 bucket. We ingest the **Mandalay city-core** sub-bbox
where the seeded reports cluster (manageable row count, real footprints).

Crisis: `Myanmar Earthquake 2026` → `018f3c2a-0001-7000-8000-000000000001`
Sub-bbox (W,S,E,N): `95.95,21.92,96.15,22.02`

## 1. Download footprints

Requires Python ≥3.9. Install the CLI once:

```bash
pip install overturemaps
```

Download buildings for the city-core bbox as GeoJSON:

```bash
overturemaps download \
  --bbox=95.95,21.92,96.15,22.02 \
  -f geojson \
  --type=building \
  -o mandalay-buildings.geojson
```

## 2. Ingest into PostGIS

`NUXT_DB_URL` is the Supavisor pooler URL (port 6543). Use the **direct/session**
connection string for bulk loads if available; the pooler also works.

### Option A — ogr2ogr (GDAL)

```bash
ogr2ogr -f PostgreSQL \
  "PG:postgresql://<user>:<pass>@<host>:5432/postgres" \
  mandalay-buildings.geojson \
  -nln buildings_import -overwrite -lco GEOMETRY_NAME=geom -t_srs EPSG:4326
```

Then map the staging table into our schema (sets the crisis_id, keeps height):

```sql
INSERT INTO buildings (crisis_id, geom, height_m, osm_type)
SELECT
  '018f3c2a-0001-7000-8000-000000000001',
  ST_Force2D(ST_CollectionExtract(geom, 3)),   -- polygons only
  NULLIF((properties->>'height'), '')::numeric,
  properties->>'class'
FROM buildings_import
WHERE ST_GeometryType(geom) IN ('ST_Polygon','ST_MultiPolygon');

DROP TABLE buildings_import;
```

### Option B — Node ingest (no GDAL)

`node scripts/ingest-buildings.mjs mandalay-buildings.geojson` — reads the
FeatureCollection, batches `INSERT … ST_GeomFromGeoJSON(...)` via `postgres.js`
using `NUXT_DB_URL`. (Use Option A if GDAL is already installed; it's faster.)

## 3. Verify

```sql
SELECT count(*) FROM buildings WHERE crisis_id = '018f3c2a-0001-7000-8000-000000000001';
```

The `/api/buildings?crisis_id=…` route then serves these as GeoJSON, and the
dashboard renders them as the `buildings-fill` / `buildings-line` layers.

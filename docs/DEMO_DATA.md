# Demo Data

The live deployment is seeded with synthetic demonstration data so that any visitor,
anywhere in the world, has a realistic crisis to report into and a populated dashboard
to explore. This document explains exactly what is real and what is not, and credits
the photographers whose work makes the demo convincing.

## What is real and what is not

- **The crises are fictional exercises.** Each one is a "SIMEX" (simulation exercise),
  standard humanitarian-sector vocabulary for a drill. They are named for regions, not
  for real events, and the names make clear they are scenarios.
- **The photos are real.** Every damage photo is genuine disaster imagery from Wikimedia
  Commons, used under its stated license (see the attribution table below). They show
  real earthquakes, floods, and storms.
- **The locations and timestamps are synthetic.** A photo of 2010 Haiti earthquake damage
  may appear in the "SIMEX Andes" scenario at a recent timestamp. The coordinates,
  timestamps, severities, and reporter identities are generated; they do not describe the
  events the photographs actually depict. Each seeded report carries its photo's true
  source and license in its description, visible to staff.
- **The pipeline is real.** Seed reports are not inserted directly. They are submitted
  through the same public API a civilian uses, so each one is geofenced, deduplicated,
  quality-scored, and trust-scored exactly like a genuine submission.
- **The AI classifications on demo reports are model-generated, not live vision calls.**
  The live reporter path classifies real photos with Groq/Gemini vision. For the synthetic
  demo seed, the AI fields are produced by a hand-authored generator
  (`scripts/demo/classify.mjs`) keyed to each report's hazard, infrastructure, and severity,
  so we never spend the (daily-capped) free vision quota on fake reports. These rows carry
  `_meta.provider: "demo"` in their audit trail; reports captured by the real model carry
  `"groq"` or `"gemini"`.

## Scenario crises

Fourteen regional scenarios give global coverage. Locations outside every zone (oceans,
poles, and uncovered regions) intentionally hit the reporter flow's "no active crisis in
your area" path, so the geofence is demonstrable both ways.

| Scenario | Hazard | Region | Example cities |
| --- | --- | --- | --- |
| SIMEX Mandalay | Earthquake | Central Myanmar | Mandalay, Sagaing, Meiktila |
| SIMEX Anatolia | Earthquake | Türkiye / N. Syria | Gaziantep, Antakya, Aleppo |
| SIMEX Andes | Earthquake | Pacific South America | Lima, Quito, Arequipa |
| SIMEX Maghreb | Earthquake | North-West Africa | Marrakesh, Agadir, Algiers |
| SIMEX Indus | Flood | Pakistan | Karachi, Hyderabad, Sukkur |
| SIMEX Gulf of Guinea | Flood | West Africa coast | Accra, Lagos, Cotonou |
| SIMEX Rhineland | Flood | NW Europe | Cologne, Liège, Maastricht |
| SIMEX Visayas | Typhoon | Central Philippines | Tacloban, Cebu, Manila |
| SIMEX Sofala | Cyclone | SE Africa | Beira, Chimoio, Maputo |
| SIMEX Antilles | Hurricane | Caribbean | Port-au-Prince, Santo Domingo, San Juan |
| SIMEX Atlantic Seaboard | Hurricane | US East / Gulf | Fort Myers, New Orleans, Houston |
| SIMEX Murray-Darling | Flood | SE Australia | Coffs Harbour, Canberra, Sydney |
| SIMEX Mekong | Flood | Mainland SE Asia | Bangkok, Phnom Penh, Ho Chi Minh City |
| SIMEX Rift Valley | Flood | East Africa | Nairobi, Addis Ababa, Kampala |

## Rebuilding the demo data

```bash
# 1. Source freshly-licensed photos into data/demo-photos/ + manifest.json
node scripts/demo/fetch-photos.mjs
# 2. Curate: review each image, set keep/infra in manifest.json
# 3. Seed through the live pipeline (wipes existing demo data first)
TARGET_URL=https://crisismapper.vercel.app node scripts/demo/seed.mjs
# 4. Regenerate the attribution table below
node scripts/demo/gen-attribution.mjs
```

The seed uses ~12 fixed reporter personas (stable pseudonymous device ids) so the
leaderboard and badges populate believably, plus a share of anonymous reports. Timestamps
are spread across the last ten days with a handful in the last hour for a live feel, and
roughly 8% of reports are deliberate near-duplicates so the dedup logic is visible.

If the AI vision provider's daily token budget runs out partway through a seed, the
affected reports are stored without an AI classification (a legitimate "AI offline" state
that the app handles gracefully). Once the budget resets, fill them in with:

```bash
TARGET_URL=https://crisismapper.vercel.app node scripts/demo/backfill-ai.mjs
```

## Photo attribution

<!-- ATTRIBUTION:START -->
82 images, all sourced from Wikimedia Commons under the licenses shown. Images were resized to 1280px and re-encoded to WebP for the app; these modifications are noted here as the CC BY-SA license requires.

| Image | Author | License | Source |
| --- | --- | --- | --- |
| Damaged port area of Port-au-Prince 2010-01-20 4.jpg | Fred W. Baker III | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Damaged_port_area_of_Port-au-Prince_2010-01-20_4.jpg) |
| 2023 Turkey earthquake.jpg | Mahmut Bozarslan (VOA) | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_earthquake.jpg) |
| 2023 Turkey Earthquake Damage.jpg | VOA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage.jpg) |
| 2023 Turkey Earthquake Damage 2.jpg | Mahmut Bozarslan (VOA)/VOA TURKICE | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage_2.jpg) |
| 2023 Turkey Earthquake Damage 3.jpg | VOA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage_3.jpg) |
| 2023 Turkey Earthquake Damage 4.jpg | VOA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage_4.jpg) |
| 2023 Turkey Earthquake Damage 5.jpg | VOA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage_5.jpg) |
| 2023 Turkey Earthquake Damage Diyarbakir.jpg | VOA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:2023_Turkey_Earthquake_Damage_Diyarbakir.jpg) |
| Hatay Eğitim ve Araştırma Hastanesi - 6 Şubat Depremi Sonrası.jpg | Mustafa Kuzugüdemn | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Hatay_E%C4%9Fitim_ve_Ara%C5%9Ft%C4%B1rma_Hastanesi_-_6_%C5%9Eubat_Depremi_Sonras%C4%B1.jpg) |
| Nepal Sanskrit University building.jpg | Suraj Belbase | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Nepal_Sanskrit_University_building.jpg) |
| Nepal Sanskrit University Kathmandu Office at Basantapur.jpg | Nirajan pant | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Nepal_Sanskrit_University_Kathmandu_Office_at_Basantapur.jpg) |
| Destroyed building of Fine Art Campus, Bhotahiti, Kathmandu.jpg | Nirajan pant | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Destroyed_building_of_Fine_Art_Campus,_Bhotahiti,_Kathmandu.jpg) |
| Earthquake affected building of Durbar High School.jpg | Nirajan pant | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Earthquake_affected_building_of_Durbar_High_School.jpg) |
| Ruins Bakhtapur 2015.png | Mario Biondi writer | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Ruins_Bakhtapur_2015.png) |
| L'Aquila eathquake prefettura.jpg | Original uploader was TheWiz83 at it.wikipedia | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_eathquake_prefettura.jpg) |
| L'Aquila 2009 - - by-RaBoe 018.jpg | Ra Boe | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2009_-_-_by-RaBoe_018.jpg) |
| L'Aquila 2009 - Santa Maria di Collemaggio - by-RaBoe 020.jpg | Ra Boe | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2009_-_Santa_Maria_di_Collemaggio_-_by-RaBoe_020.jpg) |
| L'Aquila 2009 -Santa Maria di Collemaggio - by-RaBoe 001.jpg | Ra Boe | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2009_-Santa_Maria_di_Collemaggio_-_by-RaBoe_001.jpg) |
| L'Aquila 2010 - Corso Vittorio Emanuele II - by-RaBoe-083.jpg | Ra Boe / Wikipedia | CC BY-SA 3.0 de | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2010_-_Corso_Vittorio_Emanuele_II_-_by-RaBoe-083.jpg) |
| San Domenico (L'Aquila).JPG | Lasacrasillaba | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:San_Domenico_(L%27Aquila).JPG) |
| L'Aquila 2011 by-RaBoe-242.jpg | Ra Boe / Wikipedia | CC BY-SA 3.0 de | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2011_by-RaBoe-242.jpg) |
| L'Aquila 2011 by-RaBoe-374.jpg | Ra Boe / Wikipedia | CC BY-SA 3.0 de | [Commons](https://commons.wikimedia.org/wiki/File:L%27Aquila_2011_by-RaBoe-374.jpg) |
| Terremoto 2009 Italy L'Aquila Poggio di Roio.jpg | Carlo Nannicola | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Terremoto_2009_Italy_L%27Aquila_Poggio_di_Roio.jpg) |
| Earthquake damage in L'Aquila (10667999425).jpg | UCL Mathematical and Physical Sciences from London, UK | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Earthquake_damage_in_L%27Aquila_(10667999425).jpg) |
| The aftermath of the 2009 L'Aquila earthquake (8946926748).jpg | UCL Mathematical and Physical Sciences from London, UK | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:The_aftermath_of_the_2009_L%27Aquila_earthquake_(8946926748).jpg) |
| Building after 2009 earthquake in Monticchio, village in L'Aquila, Italy.jpg | it:User:Kronos | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Building_after_2009_earthquake_in_Monticchio,_village_in_L%27Aquila,_Italy.jpg) |
| Italy-earthquakes-second-damaging-shock-rips-north-from-amatrice-3.jpg | temblor/INGV | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Italy-earthquakes-second-damaging-shock-rips-north-from-amatrice-3.jpg) |
| The Press Building (8587721523).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:The_Press_Building_(8587721523).jpg) |
| Christchurch Cathedral. (9450577406).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Christchurch_Cathedral._(9450577406).jpg) |
| The Old Government Building Christchurch..jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:The_Old_Government_Building_Christchurch..jpg) |
| Cathedral of Blessed Sacrament. Christchurch NZ (8582493780).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Cathedral_of_Blessed_Sacrament._Christchurch_NZ_(8582493780).jpg) |
| Cathedral demolition Christchurch NZ (50657380948).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Cathedral_demolition_Christchurch_NZ_(50657380948).jpg) |
| Earthquake damaged Cathedral Christchurch. NZ (47956792247).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Earthquake_damaged_Cathedral_Christchurch._NZ_(47956792247).jpg) |
| Christch Church Cathedral. Christchurch. (14411221965).jpg | Bernard Spragg. NZ from Christchurch, New Zealand | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Christch_Church_Cathedral._Christchurch._(14411221965).jpg) |
| Consequences of the floodings in Ahrweiler, Germany.3.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.3.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.5.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.5.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.12.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.12.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.18.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.18.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.20.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.20.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.21.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.21.jpg) |
| Photograph of bridge damaged by flood. - NARA - 282438.jpg | Unknown authorUnknown author or not provided | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Photograph_of_bridge_damaged_by_flood._-_NARA_-_282438.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.22.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.22.jpg) |
| Boulderflood.jpg | AlmanacManiac | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Boulderflood.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.25.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.25.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.50.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.50.jpg) |
| Jamestown, Colorado Cut Off by 2013 Colorado Floods.jpg | Steve Zumwalt/FEMA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Jamestown,_Colorado_Cut_Off_by_2013_Colorado_Floods.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.53.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.53.jpg) |
| Colorado Route 36 flood damage reconstruction 131021-Z-QD622-019.jpg | Senior Master Sgt. John Rohrer | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Colorado_Route_36_flood_damage_reconstruction_131021-Z-QD622-019.jpg) |
| Consequences of the floodings in Ahrweiler, Germany.54.jpg | Jean-Christophe Verhaegen/European Commission | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Consequences_of_the_floodings_in_Ahrweiler,_Germany.54.jpg) |
| Hochwasser 2021 01.jpg | Smigel | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Hochwasser_2021_01.jpg) |
| Road damage (Image 5 of 17) (9789650276).jpg | DVIDSHUB | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Road_damage_(Image_5_of_17)_(9789650276).jpg) |
| Boulderflood (cropped).jpg | AlmanacManiac | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Boulderflood_(cropped).jpg) |
| Hochwasser 2021 10.jpg | Smigel | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Hochwasser_2021_10.jpg) |
| BadNeuenahr Behelfsbruecke Landgrafenstr 130 20220530 2205.jpg | Karlunun | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:BadNeuenahr_Behelfsbruecke_Landgrafenstr_130_20220530_2205.jpg) |
| Manitou Springs, CO September 21, 2013-- Roads were badly damage in the Manitou Springs, CO area because of flooding. FEMA is working with local, state and other federal agencies to - DPLA - c4aca7fbfaa29252f4a91d941e4694f2.jpg | Department of Homeland Security. Federal Emergency Management Agency. Public Affairs Division. 3/1/2003 | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Manitou_Springs,_CO_September_21,_2013--_Roads_were_badly_damage_in_the_Manitou_Springs,_CO_area_because_of_flooding._FEMA_is_working_with_local,_state_and_other_federal_agencies_to_-_DPLA_-_c4aca7fbfaa29252f4a91d941e4694f2.jpg) |
| Manitou Springs, CO September 21, 2013-- Roads were badly damage in the Manitou Springs, CO area due to flooding. FEMA is working with local, state and other federal agencies to pro - DPLA - 8233fa96ddd024e3e0aaf3fe992f9b8c.jpg | Department of Homeland Security. Federal Emergency Management Agency. Public Affairs Division. 3/1/2003 | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Manitou_Springs,_CO_September_21,_2013--_Roads_were_badly_damage_in_the_Manitou_Springs,_CO_area_due_to_flooding._FEMA_is_working_with_local,_state_and_other_federal_agencies_to_pro_-_DPLA_-_8233fa96ddd024e3e0aaf3fe992f9b8c.jpg) |
| Car after flood.jpg | Sreerag S J | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Car_after_flood.jpg) |
| Thailand, flood nontaburi 01.jpg | ลิดกับเป้ | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Thailand,_flood_nontaburi_01.jpg) |
| Thailand, flood nontaburi 02.jpg | ลิดกับเป้ | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Thailand,_flood_nontaburi_02.jpg) |
| Damage and destruction to houses in Biloxi, Mississippi by hurricane Katrina 14605.jpg | FEMA/Mark Wolfe | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Damage_and_destruction_to_houses_in_Biloxi,_Mississippi_by_hurricane_Katrina_14605.jpg) |
| House in Arabi Louisiana after levee failure disaster during Hurricane Katrina - RIP sign.jpg | Infrogmation of New Orleans | CC BY 2.5 | [Commons](https://commons.wikimedia.org/wiki/File:House_in_Arabi_Louisiana_after_levee_failure_disaster_during_Hurricane_Katrina_-_RIP_sign.jpg) |
| FEMA - 37402 - Damaged Jackson Barracks in New Orleans - Katrina Third Year Anniversary.jpg | Marvin Nauman | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:FEMA_-_37402_-_Damaged_Jackson_Barracks_in_New_Orleans_-_Katrina_Third_Year_Anniversary.jpg) |
| Damage to Lower Ninth Ward after Hurricane Katrina.jpg | MattButts | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Damage_to_Lower_Ninth_Ward_after_Hurricane_Katrina.jpg) |
| New Orleans - Hurricane Katrina aftermath - March 2006 - 07.jpg | Gregory Varnum | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:New_Orleans_-_Hurricane_Katrina_aftermath_-_March_2006_-_07.jpg) |
| Navarre New Orleans, Flood Damaged House after Hurricane Katrina Levee Failure Disaster - Ceiling Damage.jpg | Infrogmation of New Orleans | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Navarre_New_Orleans,_Flood_Damaged_House_after_Hurricane_Katrina_Levee_Failure_Disaster_-_Ceiling_Damage.jpg) |
| Navarre New Orleans, Flood Damaged House after Hurricane Katrina Levee Failure Disaster - New Orleans is for Lovers B.jpg | Infrogmation of New Orleans | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Navarre_New_Orleans,_Flood_Damaged_House_after_Hurricane_Katrina_Levee_Failure_Disaster_-_New_Orleans_is_for_Lovers_B.jpg) |
| Terrytown Louisiana October 2005 - Residential neighborhood wind damage, Hurricane Katrina.jpg | Infrogmation of New Orleans | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Terrytown_Louisiana_October_2005_-_Residential_neighborhood_wind_damage,_Hurricane_Katrina.jpg) |
| House flooded from Lake Pontchartrain waters in Hurricane Katrina, New Orleans, September 2005.jpg | Photographer not credited | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:House_flooded_from_Lake_Pontchartrain_waters_in_Hurricane_Katrina,_New_Orleans,_September_2005.jpg) |
| Front door smashed 233 Capodano Sandy jeh.jpg | Jim.henderson | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Front_door_smashed_233_Capodano_Sandy_jeh.jpg) |
| Sandy damage - Union Beach NJ.jpg | Adam Moss | CC BY-SA 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Sandy_damage_-_Union_Beach_NJ.jpg) |
| B219 beach house atilt Sandy jeh.jpg | Jim.henderson | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:B219_beach_house_atilt_Sandy_jeh.jpg) |
| B204 wrecked beach house Sandy jeh.jpg | Jim.henderson | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:B204_wrecked_beach_house_Sandy_jeh.jpg) |
| B139 St smashed house Sandy jeh.jpg | Jim.henderson | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:B139_St_smashed_house_Sandy_jeh.jpg) |
| Damage from Hurricane Sandy to house in Brooklyn, NY.jpeg | Proud Novice | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Damage_from_Hurricane_Sandy_to_house_in_Brooklyn,_NY.jpeg) |
| The aftermath of Hurricane Sandy (Image 2 of 3) (8167326468).jpg | DVIDSHUB | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:The_aftermath_of_Hurricane_Sandy_(Image_2_of_3)_(8167326468).jpg) |
| Tacloban Typhoon Haiyan 2013-11-14.jpg | Trocaire from Ireland | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Tacloban_Typhoon_Haiyan_2013-11-14.jpg) |
| Tacloban Typhoon Haiyan 2013-11-13.jpg | Trocaire from Ireland | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Tacloban_Typhoon_Haiyan_2013-11-13.jpg) |
| A few palm trees remain standing amid the destruction caused by Typhoon Haiyan in the city of Tacloban, Philippines (11290331484).jpg | DFID - UK Department for International Development | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:A_few_palm_trees_remain_standing_amid_the_destruction_caused_by_Typhoon_Haiyan_in_the_city_of_Tacloban,_Philippines_(11290331484).jpg) |
| Damage to a school classroom in Tacloban caused by Typhoon Haiyan (11290331494).jpg | DFID - UK Department for International Development | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Damage_to_a_school_classroom_in_Tacloban_caused_by_Typhoon_Haiyan_(11290331494).jpg) |
| A car up-ended amid the wreckage of buildings destroyed by Typhoon Haiyan in Tacloban, Philippines (11290331544).jpg | DFID - UK Department for International Development | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:A_car_up-ended_amid_the_wreckage_of_buildings_destroyed_by_Typhoon_Haiyan_in_Tacloban,_Philippines_(11290331544).jpg) |
| Puerto Rico after Hurricane Maria (37374313795).jpg | Western Area Power | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Puerto_Rico_after_Hurricane_Maria_(37374313795).jpg) |
| Puerto Rico after Hurricane Maria (36562046513).jpg | Western Area Power | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Puerto_Rico_after_Hurricane_Maria_(36562046513).jpg) |
<!-- ATTRIBUTION:END -->

// Buildable — matching vocabularies.
// These are the single biggest determinant of match quality. They are DATA, not
// prose for a model to re-derive: an invented vocabulary silently changes which
// dataset ranks first, which is the one thing the demo depends on.

/** Dropped before token matching: common words that match everything. */
export const STOP_WORDS = new Set(
  ("a an the and or but for to of in on at by with from into about " +
   "i we you they it that this these those my our your their is are was were be been being am " +
   "do does did doing have has had having will would can could should shall may might must " +
   "want wants wanted need needs building build make makes making app application tool site website " +
   "something thing things show shows showing see sees let lets help helps so if then than as " +
   "some any all more most very really just also new using use uses used get gets got how what " +
   "where when which who why there here its im gonna like").split(" ")
);

/**
 * Tags that describe a capability or a data shape rather than a subject.
 * They still contribute to ranking, at a lower weight, but must never appear in
 * the "you mentioned X" sentence — "you mentioned nearest" reads as nonsense.
 */
export const META_TAGS = new Set([
  "map", "mapping", "dashboard", "nearest", "live", "realtime", "real time", "current",
  "today", "now", "feed", "alert", "chart", "summary", "counts", "count", "ranking",
  "top", "breakdown", "aggregated", "filtered", "join", "detail", "lookup", "reference",
  "crosswalk", "base layer", "geocode", "archived", "old", "trend", "long term",
  "history", "historical", "year", "day of week", "when", "where to open", "research",
  "new system",
]);

/** Subject areas. A domain hit is the strongest single signal in the score. */
export const DOMAIN_WORDS: Record<string, string[]> = {
  housing: ["housing","rent","rental","renter","tenant","landlord","eviction","evicted","displacement","affordable","apartment","unit","units","permit","permits","construction","build","built","building","buildings","development","adu","soft story","retrofit","property","lease","vacancy","homeowner","real estate","zoning","density","earthquake","seismic"],
  transit: ["transit","muni","bus","train","bart","commute","commuting","stop","stops","route","bike","bicycle","biking","cycling","cyclist","scooter","parking","traffic","car","cars","drive","driving","driver","street","streets","road","pedestrian","walk","walking","crash","crashes","collision","vision zero","tow","speed","intersection","lane"],
  safety: ["crime","crimes","police","safety","safe","unsafe","dangerous","incident","theft","burglary","assault","robbery","hate crime","fire","emergency","911","ems","ambulance","drone","violence","victim","arrest"],
  business: ["business","businesses","restaurant","restaurants","store","shop","shops","retail","vendor","food truck","truck","permit","license","closure","closed","opening","open","sales tax","contract","supplier","startup","commercial","storefront","merchant","corridor","entrepreneur","small business","cafe","bar"],
  civic311: ["311","complaint","complaints","report","reported","pothole","graffiti","trash","garbage","litter","cleaning","encampment","request","requests","service","dumping","sidewalk","noise"],
  environment: ["tree","trees","canopy","green","air quality","pollution","climate","emissions","greenhouse","carbon","water","beach","plant","heat","environment","environmental","sustainability","shade","park","parks","open space"],
  health: ["health","inspection","inspections","hospital","clinic","covid","disease","shelter","homeless","unhoused","social services","food safety","hygiene","restroom","bathroom","toilet","overdose","asthma","medical","wellbeing"],
  equity: ["equity","equitable","income","demographic","demographics","disparity","disparities","race","racial","district","vulnerable","poverty","underserved","access","fair","fairness","justice","gap"],
  gov: ["budget","spending","spend","salary","salaries","compensation","pay","employee","employees","city worker","ethics","lobby","survey","nonprofit","contract","procurement","transparency","accountability","government","taxpayer","department"],
  geo: ["map","mapped","boundary","boundaries","neighborhood","neighborhoods","neighbourhood","parcel","address","addresses","zip","zipcode","district","geography","geospatial","location","locations","coordinates","block","blocks","area","areas"],
  food: ["food","restaurant","eat","eating","dining","taco","lunch","dinner","menu","food truck","grocery","hungry","meal"],
  culture: ["film","movie","movies","tourism","tourist","culture","cultural","art","museum","landmark","sightseeing","walking tour","history","historic"],
  infra: ["infrastructure","street","streets","sidewalk","public works","maintenance","repair","amenity","amenities","fountain","bathroom","restroom","toilet","bench","light"],
  reference: ["join","joining","crosswalk","lookup","reference","base layer","geocode","geocoding","match","link"],
};

/** Used in "This is ___ data, the area your sentence is about." */
export const DOMAIN_LABEL: Record<string, string> = {
  housing: "housing", transit: "transport", safety: "public safety",
  business: "business and economy", civic311: "311 service request",
  environment: "environmental", health: "health and social services",
  equity: "equity", gov: "city government", geo: "geographic", food: "food",
  culture: "culture", infra: "city infrastructure", reference: "reference",
};

/** What the person wants to DO with the data, as distinct from its subject. */
export const INTENT_WORDS: Record<string, string[]> = {
  map:  ["map","maps","mapped","mapping","heatmap","heat map","geographic","geographical","spatial","where","locate","nearest","near me","nearby","plot","pin","pins","block","blocks","route","radius","distance","walk to","find the closest"],
  time: ["trend","trends","over time","history","historical","change","changed","changing","growth","growing","decline","declining","monthly","yearly","annual","year over year","since","pattern","patterns","seasonal","track","tracking","chart","compare over"],
  live: ["live","real time","real-time","realtime","current","currently","now","today","up to date","latest","dashboard","alert","alerts","notify","notification","monitor","monitoring","daily"],
  join: ["join","combine","combining","merge","link","linking","cross reference","cross-reference","correlate","correlation","compare","comparing","versus","vs","against","overlay","relationship","together with"],
  ml:   ["predict","prediction","predictive","model","modelling","modeling","machine learning","ml","forecast","forecasting","classify","classifier","train","ai","score","risk score","algorithm"],
};

/** Base layers suggested whenever the sentence implies anything geographic. */
export const BASE_LAYER_REASONS: Record<string, string> = {
  "j2bu-swwd": "Almost every SF dataset aggregates to these 41 neighborhoods. Use them as your map's base layer instead of inventing your own areas.",
  "acdm-wktn": "If you need to tie anything to a specific property rather than a point on a street, parcels are the join key everyone else uses.",
  "jc98-7xvv": "Only if your other data arrives by ZIP code — this crosswalk gets you from ZIPs to SF's neighborhood vocabulary.",
};

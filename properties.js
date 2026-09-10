// Public facts about the 10 properties. Safe to expose — actual sold prices
// live only in Firestore's "answers" collection, gated to the host by security rules.
var PROPERTIES = [
  { id:'p1', address:'Alabastervägen 8, Beckomberga', area:127, rooms:'5 rum', builtYear:2009, type:'Villa',
    lat:59.3571457, lng:17.9057908, imgOutside:'images/p1_outside.webp', imgInside:'images/p1_inside.webp' },
  { id:'p2', address:'Rättar Vigs väg 98, Vällingby', area:41, rooms:'2 rum', builtYear:null, type:'Villa',
    lat:59.3717277, lng:17.8854411, imgOutside:'images/p2_outside.webp', imgInside:'images/p2_inside.webp' },
  { id:'p3', address:'Gliavägen 95, Bromma Kyrka', area:219, rooms:'7 rum', builtYear:1965, type:'Villa',
    lat:59.3529231, lng:17.9223389, imgOutside:'images/p3_outside.webp', imgInside:'images/p3_inside.webp' },
  { id:'p4', address:'Blåsklöverbacken 6, Hässelby Norra Villastad', area:133, rooms:'5 rum', builtYear:1975, type:'Kedjehus, äganderätt',
    lat:59.3938905, lng:17.8202002, imgOutside:'images/p4_outside.webp', imgInside:'images/p4_inside.webp' },
  { id:'p5', address:'Ulvögatan 13, Vällingby', area:125, rooms:'6 rum', builtYear:1959, type:'Kedjehus, äganderätt',
    lat:59.3681786, lng:17.8752258, imgOutside:'images/p5_outside.webp', imgInside:'images/p5_inside.webp' },
  { id:'p6', address:'Alströmergatan 35, Kungsholmen', area:33, rooms:'1,5 rum', builtYear:1941, type:'Bostadsrätt, lägenhet',
    lat:59.3354299, lng:18.0296024, imgOutside:'images/p6_outside.webp', imgInside:'images/p6_inside.webp' },
  { id:'p7', address:'Alfons Åbergs gata 5, Bromma', area:101, rooms:'5 rum', builtYear:2013, type:'Bostadsrätt, lägenhet',
    lat:59.3650861, lng:17.9461549, imgOutside:'images/p7_outside.jpeg', imgInside:'images/p7_inside.webp' },
  { id:'p8', address:'Atlasgatan 13, Vasastan', area:45, rooms:'2 rum', builtYear:1929, type:'Bostadsrätt, lägenhet',
    lat:59.3383476, lng:18.0375578, imgOutside:'images/p8_outside.webp', imgInside:'images/p8_inside.webp' },
  { id:'p9', address:'Fastlagsvägen 55, Aspudden', area:52, rooms:'2 rum', builtYear:1942, type:'Bostadsrätt, lägenhet',
    lat:59.3033864, lng:17.9934521, imgOutside:'images/p9_outside.webp', imgInside:'images/p9_inside.webp' },
  { id:'p10', address:'Birger Jarlsgatan 46B, Östermalm', area:103, rooms:'4 rum', builtYear:1929, type:'Bostadsrätt, lägenhet',
    lat:59.3401518, lng:18.0671984, imgOutside:'images/p10_outside.webp', imgInside:'images/p10_inside.webp' }
];

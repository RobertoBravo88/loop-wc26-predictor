/**
 * Loop WC26 Predictor — Database Seed Script
 *
 * Populates: all 48 teams, 72 group stage fixtures, 32 knockout placeholders
 * Run with: node seed.js
 *
 * Data source: TheSportsDB (verified against FIFA schedule)
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================================
// 48 TEAMS — all groups confirmed for WC 2026
// ============================================================
const TEAMS = [
  // Group A
  { name: 'Mexico',       short_name: 'MEX', group_letter: 'A', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/3rmosi1748525208.png' },
  { name: 'South Korea',  short_name: 'KOR', group_letter: 'A', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/a8nqfs1589564916.png' },
  { name: 'Czech Republic',short_name: 'CZE', group_letter: 'A', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/1o0cx31654205806.png' },
  { name: 'South Africa', short_name: 'RSA', group_letter: 'A', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/xjz9j91553368824.png' },
  // Group B
  { name: 'Canada',           short_name: 'CAN', group_letter: 'B', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/2t631f1595154867.png' },
  { name: 'Switzerland',      short_name: 'SUI', group_letter: 'B', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/mb7yqe1717365808.png' },
  { name: 'Bosnia-Herzegovina',short_name: 'BIH', group_letter: 'B', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/wtqqst1455463120.png' },
  { name: 'Qatar',            short_name: 'QAT', group_letter: 'B', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/rs3ir31642708685.png' },
  // Group C
  { name: 'Brazil',   short_name: 'BRA', group_letter: 'C', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/jl6dip1726167280.png' },
  { name: 'Morocco',  short_name: 'MAR', group_letter: 'C', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/hbmwkj1731791275.png' },
  { name: 'Scotland', short_name: 'SCO', group_letter: 'C', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/3691i11552945146.png' },
  { name: 'Haiti',    short_name: 'HAI', group_letter: 'C', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/gml8wx1598135302.png' },
  // Group D
  { name: 'USA',       short_name: 'USA', group_letter: 'D', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/21f0oi1597948195.png' },
  { name: 'Turkey',    short_name: 'TUR', group_letter: 'D', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/70c4oo1591982459.png' },
  { name: 'Australia', short_name: 'AUS', group_letter: 'D', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/lark6k1661780848.png' },
  { name: 'Paraguay',  short_name: 'PAR', group_letter: 'D', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/khgav41553419195.png' },
  // Group E
  { name: 'Germany',     short_name: 'GER', group_letter: 'E', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/1xysi51726167152.png' },
  { name: 'Ecuador',     short_name: 'ECU', group_letter: 'E', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/47wv2y1591989301.png' },
  { name: 'Ivory Coast', short_name: 'CIV', group_letter: 'E', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/rwxuuu1455465643.png' },
  { name: 'Curaçao',    short_name: 'CUW', group_letter: 'E', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/itygvb1600955363.png' },
  // Group F
  { name: 'Netherlands', short_name: 'NED', group_letter: 'F', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/1p0hr41593787110.png' },
  { name: 'Japan',       short_name: 'JPN', group_letter: 'F', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/ffsyxz1591989843.png' },
  { name: 'Sweden',      short_name: 'SWE', group_letter: 'F', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/h5adzg1591981772.png' },
  { name: 'Tunisia',     short_name: 'TUN', group_letter: 'F', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/7r89rg1526727277.png' },
  // Group G
  { name: 'Belgium',     short_name: 'BEL', group_letter: 'G', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/8xlvxv1592062265.png' },
  { name: 'Iran',        short_name: 'IRN', group_letter: 'G', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/uttpvw1455465617.png' },
  { name: 'Egypt',       short_name: 'EGY', group_letter: 'G', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/uheyzo1742102234.png' },
  { name: 'New Zealand', short_name: 'NZL', group_letter: 'G', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/91xpk81742982935.png' },
  // Group H
  { name: 'Spain',        short_name: 'ESP', group_letter: 'H', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/ncgqyr1726166942.png' },
  { name: 'Uruguay',      short_name: 'URU', group_letter: 'H', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/6vjbr11726167756.png' },
  { name: 'Saudi Arabia', short_name: 'KSA', group_letter: 'H', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/24xwpq1594125742.png' },
  { name: 'Cape Verde',   short_name: 'CPV', group_letter: 'H', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/5jn0o71593280376.png' },
  // Group I
  { name: 'France',   short_name: 'FRA', group_letter: 'I', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/p3n0z51726166851.png' },
  { name: 'Senegal',  short_name: 'SEN', group_letter: 'I', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/wh8dya1526727459.png' },
  { name: 'Norway',   short_name: 'NOR', group_letter: 'I', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/gyfn811591973155.png' },
  { name: 'Iraq',     short_name: 'IRQ', group_letter: 'I', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/aqidfn1742100110.png' },
  // Group J
  { name: 'Argentina', short_name: 'ARG', group_letter: 'J', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/3zplhu1726167477.png' },
  { name: 'Algeria',   short_name: 'ALG', group_letter: 'J', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/rrwpry1455460218.png' },
  { name: 'Austria',   short_name: 'AUT', group_letter: 'J', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/874p631628721400.png' },
  { name: 'Jordan',    short_name: 'JOR', group_letter: 'J', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/59fo2s1742100034.png' },
  // Group K
  { name: 'Portugal',    short_name: 'POR', group_letter: 'K', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/swqvpy1455466083.png' },
  { name: 'Colombia',    short_name: 'COL', group_letter: 'K', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/4ymyku1691180081.png' },
  { name: 'DR Congo',    short_name: 'COD', group_letter: 'K', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/s85jjw1728749022.png' },
  { name: 'Uzbekistan',  short_name: 'UZB', group_letter: 'K', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/u5bgze1597943605.png' },
  // Group L
  { name: 'England', short_name: 'ENG', group_letter: 'L', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/vf5ttc1726166739.png' },
  { name: 'Croatia', short_name: 'CRO', group_letter: 'L', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/vvtsyu1455465317.png' },
  { name: 'Ghana',   short_name: 'GHA', group_letter: 'L', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/j589xw1751526124.png' },
  { name: 'Panama',  short_name: 'PAN', group_letter: 'L', flag_url: 'https://r2.thesportsdb.com/images/media/team/badge/asp2ck1715849700.png' },
]

// ============================================================
// 72 GROUP STAGE FIXTURES (verified from TheSportsDB)
// ============================================================
const GROUP_FIXTURES = [
  // === ROUND 1 ===
  { home: 'Mexico',      away: 'South Africa',     kickoff: '2026-06-11T19:00:00Z', group: 'A', venue: 'Estadio Azteca, Mexico City' },
  { home: 'South Korea', away: 'Czech Republic',   kickoff: '2026-06-12T02:00:00Z', group: 'A', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Canada',      away: 'Bosnia-Herzegovina', kickoff: '2026-06-12T19:00:00Z', group: 'B', venue: 'BMO Field, Toronto' },
  { home: 'Qatar',       away: 'Switzerland',      kickoff: '2026-06-13T19:00:00Z', group: 'B', venue: "Levi's Stadium, San Francisco" },
  { home: 'Brazil',      away: 'Morocco',          kickoff: '2026-06-13T22:00:00Z', group: 'C', venue: 'MetLife Stadium, New York' },
  { home: 'Haiti',       away: 'Scotland',         kickoff: '2026-06-14T01:00:00Z', group: 'C', venue: 'Gillette Stadium, Boston' },
  { home: 'USA',         away: 'Paraguay',         kickoff: '2026-06-13T01:00:00Z', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
  { home: 'Australia',   away: 'Turkey',           kickoff: '2026-06-14T04:00:00Z', group: 'D', venue: 'BC Place, Vancouver' },
  { home: 'Germany',     away: 'Curaçao',         kickoff: '2026-06-14T17:00:00Z', group: 'E', venue: 'Reliant Stadium, Houston' },
  { home: 'Ivory Coast', away: 'Ecuador',          kickoff: '2026-06-14T23:00:00Z', group: 'E', venue: 'Lincoln Financial Field, Philadelphia' },
  { home: 'Netherlands', away: 'Japan',            kickoff: '2026-06-14T20:00:00Z', group: 'F', venue: 'AT&T Stadium, Dallas' },
  { home: 'Sweden',      away: 'Tunisia',          kickoff: '2026-06-15T02:00:00Z', group: 'F', venue: 'Estadio BBVA, Monterrey' },
  { home: 'Belgium',     away: 'Egypt',            kickoff: '2026-06-15T19:00:00Z', group: 'G', venue: 'Lumen Field, Seattle' },
  { home: 'Iran',        away: 'New Zealand',      kickoff: '2026-06-16T01:00:00Z', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
  { home: 'Spain',       away: 'Cape Verde',       kickoff: '2026-06-15T16:00:00Z', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Saudi Arabia',away: 'Uruguay',          kickoff: '2026-06-15T22:00:00Z', group: 'H', venue: 'Hard Rock Stadium, Miami' },
  { home: 'France',      away: 'Senegal',          kickoff: '2026-06-16T19:00:00Z', group: 'I', venue: 'MetLife Stadium, New York' },
  { home: 'Iraq',        away: 'Norway',           kickoff: '2026-06-16T22:00:00Z', group: 'I', venue: 'Gillette Stadium, Boston' },
  { home: 'Argentina',   away: 'Algeria',          kickoff: '2026-06-17T01:00:00Z', group: 'J', venue: 'GEHA Field at Arrowhead Stadium, Kansas City' },
  { home: 'Austria',     away: 'Jordan',           kickoff: '2026-06-17T04:00:00Z', group: 'J', venue: "Levi's Stadium, San Francisco" },
  { home: 'Portugal',    away: 'DR Congo',         kickoff: '2026-06-17T17:00:00Z', group: 'K', venue: 'Reliant Stadium, Houston' },
  { home: 'Uzbekistan',  away: 'Colombia',         kickoff: '2026-06-18T02:00:00Z', group: 'K', venue: 'Estadio Azteca, Mexico City' },
  { home: 'England',     away: 'Croatia',          kickoff: '2026-06-17T20:00:00Z', group: 'L', venue: 'AT&T Stadium, Dallas' },
  { home: 'Ghana',       away: 'Panama',           kickoff: '2026-06-17T23:00:00Z', group: 'L', venue: 'BMO Field, Toronto' },
  // === ROUND 2 ===
  { home: 'Czech Republic', away: 'South Africa',    kickoff: '2026-06-18T16:00:00Z', group: 'A', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Mexico',         away: 'South Korea',     kickoff: '2026-06-19T01:00:00Z', group: 'A', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Canada',         away: 'Qatar',           kickoff: '2026-06-18T22:00:00Z', group: 'B', venue: 'BC Place, Vancouver' },
  { home: 'Switzerland',    away: 'Bosnia-Herzegovina', kickoff: '2026-06-18T19:00:00Z', group: 'B', venue: 'SoFi Stadium, Los Angeles' },
  { home: 'Brazil',         away: 'Haiti',           kickoff: '2026-06-20T00:30:00Z', group: 'C', venue: 'Lincoln Financial Field, Philadelphia' },
  { home: 'Scotland',       away: 'Morocco',         kickoff: '2026-06-19T22:00:00Z', group: 'C', venue: 'Gillette Stadium, Boston' },
  { home: 'USA',            away: 'Australia',       kickoff: '2026-06-19T19:00:00Z', group: 'D', venue: 'Lumen Field, Seattle' },
  { home: 'Turkey',         away: 'Paraguay',        kickoff: '2026-06-20T03:00:00Z', group: 'D', venue: "Levi's Stadium, San Francisco" },
  { home: 'Germany',        away: 'Ivory Coast',     kickoff: '2026-06-20T20:00:00Z', group: 'E', venue: 'BMO Field, Toronto' },
  { home: 'Ecuador',        away: 'Curaçao',        kickoff: '2026-06-21T00:00:00Z', group: 'E', venue: 'GEHA Field at Arrowhead Stadium, Kansas City' },
  { home: 'Netherlands',    away: 'Sweden',          kickoff: '2026-06-20T17:00:00Z', group: 'F', venue: 'Reliant Stadium, Houston' },
  { home: 'Tunisia',        away: 'Japan',           kickoff: '2026-06-21T04:00:00Z', group: 'F', venue: 'Estadio BBVA, Monterrey' },
  { home: 'Belgium',        away: 'Iran',            kickoff: '2026-06-21T19:00:00Z', group: 'G', venue: 'SoFi Stadium, Los Angeles' },
  { home: 'New Zealand',    away: 'Egypt',           kickoff: '2026-06-22T01:00:00Z', group: 'G', venue: 'BC Place, Vancouver' },
  { home: 'Spain',          away: 'Saudi Arabia',    kickoff: '2026-06-21T16:00:00Z', group: 'H', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Uruguay',        away: 'Cape Verde',      kickoff: '2026-06-21T22:00:00Z', group: 'H', venue: 'Hard Rock Stadium, Miami' },
  { home: 'France',         away: 'Iraq',            kickoff: '2026-06-22T21:00:00Z', group: 'I', venue: 'Lincoln Financial Field, Philadelphia' },
  { home: 'Norway',         away: 'Senegal',         kickoff: '2026-06-23T00:00:00Z', group: 'I', venue: 'MetLife Stadium, New York' },
  { home: 'Argentina',      away: 'Austria',         kickoff: '2026-06-22T17:00:00Z', group: 'J', venue: 'AT&T Stadium, Dallas' },
  { home: 'Jordan',         away: 'Algeria',         kickoff: '2026-06-23T03:00:00Z', group: 'J', venue: "Levi's Stadium, San Francisco" },
  { home: 'Portugal',       away: 'Uzbekistan',      kickoff: '2026-06-23T17:00:00Z', group: 'K', venue: 'Reliant Stadium, Houston' },
  { home: 'Colombia',       away: 'DR Congo',        kickoff: '2026-06-24T02:00:00Z', group: 'K', venue: 'Estadio Akron, Guadalajara' },
  { home: 'England',        away: 'Ghana',           kickoff: '2026-06-23T20:00:00Z', group: 'L', venue: 'Gillette Stadium, Boston' },
  { home: 'Panama',         away: 'Croatia',         kickoff: '2026-06-23T23:00:00Z', group: 'L', venue: 'BMO Field, Toronto' },
  // === ROUND 3 (simultaneous) ===
  { home: 'South Africa', away: 'South Korea',      kickoff: '2026-06-25T01:00:00Z', group: 'A', venue: 'Estadio BBVA, Monterrey' },
  { home: 'Czech Republic',away: 'Mexico',          kickoff: '2026-06-25T01:00:00Z', group: 'A', venue: 'Estadio Azteca, Mexico City' },
  { home: 'Switzerland',  away: 'Canada',           kickoff: '2026-06-24T19:00:00Z', group: 'B', venue: 'BC Place, Vancouver' },
  { home: 'Bosnia-Herzegovina', away: 'Qatar',      kickoff: '2026-06-24T19:00:00Z', group: 'B', venue: 'Lumen Field, Seattle' },
  { home: 'Morocco',      away: 'Haiti',            kickoff: '2026-06-24T22:00:00Z', group: 'C', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Scotland',     away: 'Brazil',           kickoff: '2026-06-24T22:00:00Z', group: 'C', venue: 'Hard Rock Stadium, Miami' },
  { home: 'USA',          away: 'Turkey',           kickoff: '2026-06-26T02:00:00Z', group: 'D', venue: 'SoFi Stadium, Los Angeles' },
  { home: 'Paraguay',     away: 'Australia',        kickoff: '2026-06-26T02:00:00Z', group: 'D', venue: "Levi's Stadium, San Francisco" },
  { home: 'Ecuador',      away: 'Germany',          kickoff: '2026-06-25T20:00:00Z', group: 'E', venue: 'MetLife Stadium, New York' },
  { home: 'Curaçao',     away: 'Ivory Coast',       kickoff: '2026-06-25T20:00:00Z', group: 'E', venue: 'Lincoln Financial Field, Philadelphia' },
  { home: 'Japan',        away: 'Sweden',           kickoff: '2026-06-25T23:00:00Z', group: 'F', venue: 'AT&T Stadium, Dallas' },
  { home: 'Tunisia',      away: 'Netherlands',      kickoff: '2026-06-25T23:00:00Z', group: 'F', venue: 'GEHA Field at Arrowhead Stadium, Kansas City' },
  { home: 'Egypt',        away: 'Iran',             kickoff: '2026-06-27T03:00:00Z', group: 'G', venue: 'Lumen Field, Seattle' },
  { home: 'New Zealand',  away: 'Belgium',          kickoff: '2026-06-27T03:00:00Z', group: 'G', venue: 'BC Place, Vancouver' },
  { home: 'Uruguay',      away: 'Spain',            kickoff: '2026-06-27T00:00:00Z', group: 'H', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Cape Verde',   away: 'Saudi Arabia',     kickoff: '2026-06-27T00:00:00Z', group: 'H', venue: 'Reliant Stadium, Houston' },
  { home: 'Norway',       away: 'France',           kickoff: '2026-06-26T19:00:00Z', group: 'I', venue: 'Gillette Stadium, Boston' },
  { home: 'Senegal',      away: 'Iraq',             kickoff: '2026-06-26T19:00:00Z', group: 'I', venue: 'BMO Field, Toronto' },
  { home: 'Algeria',      away: 'Austria',          kickoff: '2026-06-28T02:00:00Z', group: 'J', venue: 'GEHA Field at Arrowhead Stadium, Kansas City' },
  { home: 'Jordan',       away: 'Argentina',        kickoff: '2026-06-28T02:00:00Z', group: 'J', venue: 'AT&T Stadium, Dallas' },
  { home: 'Colombia',     away: 'Portugal',         kickoff: '2026-06-27T23:30:00Z', group: 'K', venue: 'Hard Rock Stadium, Miami' },
  { home: 'DR Congo',     away: 'Uzbekistan',       kickoff: '2026-06-27T23:30:00Z', group: 'K', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Croatia',      away: 'Ghana',            kickoff: '2026-06-27T21:00:00Z', group: 'L', venue: 'Lincoln Financial Field, Philadelphia' },
  { home: 'Panama',       away: 'England',          kickoff: '2026-06-27T21:00:00Z', group: 'L', venue: 'MetLife Stadium, New York' },
]

// ============================================================
// KNOCKOUT PLACEHOLDERS — correct dates, TBD teams
// Round of 32: June 28 – July 3 (16 matches)
// Round of 16: July 4–7 (8 matches)
// QF: July 9–11 (4 matches)
// SF: July 14–15 (2 matches)
// 3rd: July 18 | Final: July 19
// ============================================================
const KNOCKOUT_FIXTURES = [
  // Round of 32
  { stage: 'round_of_32', kickoff: '2026-06-28T20:00:00Z', venue: 'SoFi Stadium, Los Angeles' },
  { stage: 'round_of_32', kickoff: '2026-06-28T23:00:00Z', venue: 'MetLife Stadium, New York' },
  { stage: 'round_of_32', kickoff: '2026-06-29T19:00:00Z', venue: 'AT&T Stadium, Dallas' },
  { stage: 'round_of_32', kickoff: '2026-06-29T22:00:00Z', venue: 'Lumen Field, Seattle' },
  { stage: 'round_of_32', kickoff: '2026-06-30T19:00:00Z', venue: 'Hard Rock Stadium, Miami' },
  { stage: 'round_of_32', kickoff: '2026-06-30T22:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { stage: 'round_of_32', kickoff: '2026-07-01T19:00:00Z', venue: 'BC Place, Vancouver' },
  { stage: 'round_of_32', kickoff: '2026-07-01T22:00:00Z', venue: 'Estadio Azteca, Mexico City' },
  { stage: 'round_of_32', kickoff: '2026-07-02T19:00:00Z', venue: 'Gillette Stadium, Boston' },
  { stage: 'round_of_32', kickoff: '2026-07-02T22:00:00Z', venue: 'Reliant Stadium, Houston' },
  { stage: 'round_of_32', kickoff: '2026-07-03T19:00:00Z', venue: 'Lincoln Financial Field, Philadelphia' },
  { stage: 'round_of_32', kickoff: '2026-07-03T22:00:00Z', venue: 'GEHA Field at Arrowhead Stadium, Kansas City' },
  { stage: 'round_of_32', kickoff: '2026-07-03T01:00:00Z', venue: 'BMO Field, Toronto' },
  { stage: 'round_of_32', kickoff: '2026-07-03T04:00:00Z', venue: 'Estadio BBVA, Monterrey' },
  { stage: 'round_of_32', kickoff: '2026-07-03T17:00:00Z', venue: "Levi's Stadium, San Francisco" },
  { stage: 'round_of_32', kickoff: '2026-07-03T20:00:00Z', venue: 'Estadio Akron, Guadalajara' },
  // Round of 16
  { stage: 'quarter_final', kickoff: '2026-07-04T20:00:00Z', venue: 'MetLife Stadium, New York' },
  { stage: 'quarter_final', kickoff: '2026-07-05T19:00:00Z', venue: 'AT&T Stadium, Dallas' },
  { stage: 'quarter_final', kickoff: '2026-07-05T22:00:00Z', venue: 'SoFi Stadium, Los Angeles' },
  { stage: 'quarter_final', kickoff: '2026-07-06T19:00:00Z', venue: 'Hard Rock Stadium, Miami' },
  { stage: 'quarter_final', kickoff: '2026-07-06T22:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { stage: 'quarter_final', kickoff: '2026-07-07T19:00:00Z', venue: 'BC Place, Vancouver' },
  { stage: 'quarter_final', kickoff: '2026-07-07T22:00:00Z', venue: 'Lumen Field, Seattle' },
  { stage: 'quarter_final', kickoff: '2026-07-04T23:00:00Z', venue: 'Gillette Stadium, Boston' },
  // Quarter-finals
  { stage: 'semi_final', kickoff: '2026-07-09T20:00:00Z', venue: 'AT&T Stadium, Dallas' },
  { stage: 'semi_final', kickoff: '2026-07-10T20:00:00Z', venue: 'MetLife Stadium, New York' },
  { stage: 'semi_final', kickoff: '2026-07-11T19:00:00Z', venue: 'SoFi Stadium, Los Angeles' },
  { stage: 'semi_final', kickoff: '2026-07-11T22:00:00Z', venue: 'Hard Rock Stadium, Miami' },
  // Semi-finals
  { stage: 'final', kickoff: '2026-07-14T20:00:00Z', venue: 'AT&T Stadium, Dallas' },
  { stage: 'final', kickoff: '2026-07-15T20:00:00Z', venue: 'MetLife Stadium, New York' },
  // 3rd place & Final
  { stage: 'third_place', kickoff: '2026-07-18T20:00:00Z', venue: 'Hard Rock Stadium, Miami' },
  { stage: 'final',       kickoff: '2026-07-19T20:00:00Z', venue: 'MetLife Stadium, New York' },
]

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function seed() {
  console.log('🌱 Starting WC26 database seed...\n')

  // 1. Insert teams
  console.log(`📦 Inserting ${TEAMS.length} teams...`)
  const { data: insertedTeams, error: teamsError } = await supabase
    .from('teams')
    .upsert(TEAMS, { onConflict: 'name' })
    .select()

  if (teamsError) {
    console.error('❌ Teams error:', teamsError.message)
    process.exit(1)
  }
  console.log(`✅ ${insertedTeams.length} teams inserted\n`)

  // Build name -> id map
  const teamMap = new Map(insertedTeams.map(t => [t.name, t.id]))

  // 2. Insert group stage fixtures
  console.log(`📅 Inserting ${GROUP_FIXTURES.length} group stage fixtures...`)
  const groupRows = GROUP_FIXTURES.map((f, i) => ({
    stage: 'group',
    group_letter: f.group,
    match_number: i + 1,
    home_team_id: teamMap.get(f.home) ?? null,
    away_team_id: teamMap.get(f.away) ?? null,
    kickoff_at: f.kickoff,
    venue: f.venue,
    status: 'scheduled',
  }))

  const missing = groupRows.filter(r => !r.home_team_id || !r.away_team_id)
  if (missing.length > 0) {
    console.warn(`⚠️  ${missing.length} fixtures have unresolved teams — check team names`)
    missing.forEach(r => console.warn('   Missing:', r))
  }

  const { error: groupError } = await supabase.from('matches').upsert(groupRows, {
    onConflict: 'kickoff_at,home_team_id,away_team_id',
    ignoreDuplicates: true,
  })

  if (groupError) {
    console.error('❌ Group fixtures error:', groupError.message)
    process.exit(1)
  }
  console.log(`✅ Group stage fixtures inserted\n`)

  // 3. Insert knockout placeholders
  console.log(`🏆 Inserting ${KNOCKOUT_FIXTURES.length} knockout placeholders...`)
  const knockoutRows = KNOCKOUT_FIXTURES.map((f, i) => ({
    stage: f.stage,
    match_number: 73 + i,
    home_team_id: null,
    away_team_id: null,
    kickoff_at: f.kickoff,
    venue: f.venue,
    status: 'scheduled',
  }))

  const { error: knockoutError } = await supabase.from('matches').upsert(knockoutRows, {
    ignoreDuplicates: true,
  })

  if (knockoutError) {
    console.error('❌ Knockout fixtures error:', knockoutError.message)
    process.exit(1)
  }
  console.log(`✅ Knockout placeholders inserted\n`)

  // Summary
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true })
  const { count: matchCount } = await supabase.from('matches').select('*', { count: 'exact', head: true })

  console.log('═══════════════════════════════════')
  console.log('🎉 Seed complete!')
  console.log(`   Teams in DB:   ${teamCount}`)
  console.log(`   Matches in DB: ${matchCount}`)
  console.log('═══════════════════════════════════\n')
  console.log('Next steps:')
  console.log('  1. Run the Supabase SQL migrations (001 + 002)')
  console.log('  2. node seed.js   ← you just did this!')
  console.log('  3. Deploy to Vercel')
  console.log('  4. Add env variables in Vercel dashboard\n')
}

seed().catch(console.error)

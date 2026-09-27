const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fields = require('../js/v1-form-fields.js');
const config = require('../data/official-requirements/integration/v1-preview.json');
const assets = Object.fromEntries(Object.entries(config.assets).map(([id,p]) => [id,JSON.parse(fs.readFileSync(path.join(root,p)))]));
function complete(extra = {}) {
  return { nationality:'IN',residence:'IE',age:'30',special:'no',document:'ordinary',issue:'2028-01-01',expiry:'2038-01-01',pages:'4',destination:'FR',purpose:'tourism',entry:'2030-06-01',exit:'2030-06-10',irp:'yes',irp_expiry:'2031-01-01',history:'no',accommodation:'HOTEL',accommodation_evidence:'yes',insurance:'yes',finance:'yes',sponsored:'no',return_evidence:'yes',itinerary:'yes',purpose_evidence:'yes',intention:'yes',community_details:'no',previous_bio:'no',...extra };
}
module.exports = { fields,config,assets,complete };

const {fields,config,assets,complete}=require('./v1-form-fixtures.cjs');
const {adapt}=require('../js/rules/v1-form-adapter.js');
const {evaluate}=require('../js/rules/v1-integration.js');
const {normalizeApplicantFacts}=require('../js/rules/applicant-facts.js');
function strong(expiry='2030-12-10'){
  const adapted=adapt(complete(),fields,config),raw=structuredClone(adapted.model.facts);
  raw.identity.country_of_origin='IN';
  raw.trip.return_destination_country='IE';raw.trip.intended_return_date='2030-06-10';
  raw.residence.document.expiry_date=expiry;raw.residence.irish_residence_card_expiry_date=null;
  raw.application.lodging_date='2030-04-01';raw.application.intended_lodging_date='2030-04-01';
  raw.supporting_evidence.travel_medical_insurance={present:true,coverage_amount:30000,currency:'EUR',valid_from:'2030-06-01',valid_to:'2030-06-10',territorial_scope:'SCHENGEN',medical_repatriation_covered:true,emergency_medical_covered:true,hospital_treatment_covered:true};
  adapted.model=normalizeApplicantFacts(raw);
  return evaluate(adapted,config,assets);
}
const community=(percent=78)=>({statistics:{percent,sampleSize:9},provenance:{fixture:'TEST ONLY; numerical golden preserved'},limitations:['Small historical sample; no confidence estimate.']});
module.exports={strong,community};

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fields=require('../../js/v1-form-fields.js');
const {adapt,isVisible}=require('../../js/rules/v1-form-adapter.js');
const config=require('../../data/official-requirements/integration/v1-preview.json');
const {evaluate}=require('../../js/rules/v1-integration.js');
const fs=require('node:fs');
const assets=Object.fromEntries(Object.entries(config.assets).map(([id,p])=>[id,JSON.parse(fs.readFileSync(p))]));
const visible=(id,v)=>isVisible(fields.find(f=>f.id===id),v,fields);
const model=v=>adapt(v,fields,config).model.facts;
const profile={nationality:'IN',residence:'IE',legal:'yes',irp:'yes',age:'30',special:'no',document:'ordinary',destination:'FR',purpose:'tourism',other_schengen:'no',activity:'no',entry:'2030-06-01',exit:'2030-06-10'};
const stay={entry_date:'2030-01-01',exit_date:'2030-01-02',authorization_type:'SHORT_STAY'};

test('simplification: normal profile completes route identity without country of origin',()=>{
 const a=adapt(profile,fields,config),r=evaluate(a,config,assets);
 assert.equal(a.model.facts.identity.country_of_origin,null);assert.equal(r.route.status,'SUPPORTED');
 assert.equal(r.legal.find(x=>x.rule_id==='FRANCE_IE_IRP_POST_RETURN_VALIDITY').status,'UNKNOWN');
 assert.equal(visible('origin',profile),false);
});
test('simplification: optional origin is explicit and does not alias nationality',()=>{
 assert.equal(model({...profile,origin_details:'yes',origin:'IE'}).identity.country_of_origin,'IE');
 assert.equal(model({...profile,origin_details:'no',origin:'IN'}).identity.country_of_origin,null);
});
test('simplification: narrow route fields derive only from explicit supported choices',()=>{
 const f=model(profile);assert.equal(f.passport.issuing_country,'IN');assert.equal(f.trip.destination_territory,'metropolitan_france');assert.equal(f.trip.visa_regime,'schengen');assert.equal(f.trip.visa_type,'short_stay');
 assert.equal(model({...profile,nationality:'OTHER'}).passport.issuing_country,null);
 assert.equal(model({...profile,document:'diplomatic'}).passport.issuing_country,null);
 assert.equal(model({...profile,destination:'ES'}).trip.visa_regime,null);
 assert.equal(model({...profile,purpose:''}).trip.visa_type,null);
});
test('simplification: unknown special circumstances never default to ordinary',()=>{
 assert.equal(model({...profile,special:''}).identity.applicant_conditions,null);
 assert.equal(model({...profile,special:'unsure'}).trip.family_settlement_planned,null);
 assert.equal(model({...profile,age:''}).identity.applicant_conditions,null);
 assert.deepEqual(model(profile).identity.applicant_conditions,['ordinary_adult_applicant']);
});
test('simplification: other destinations never guess competence',()=>{
 for(const value of ['yes','unsure','']){const a=adapt({...profile,other_schengen:value},fields,config);assert.equal(a.model.facts.application.competent_state,null);assert.equal(a.model.facts.trip.relevant_schengen_departure_date,null);assert.equal(evaluate(a,config,assets).route.status,'PARTIAL');}
});
test('simplification: return evidence has one primary question',()=>{
 assert.equal(fields.filter(f=>f.path==='supporting_evidence.return_or_onward_evidence.return_or_onward_evidence_present').length,1);
 for(const id of ['reservation','return_funds','funds_ticket'])assert.ok(!fields.some(f=>f.id===id));
 const f=model({return_evidence:'yes',return_money:'yes'});assert.equal(f.supporting_evidence.return_or_onward_evidence.return_or_onward_evidence_present,true);assert.equal(f.supporting_evidence.financial_means.return_funds_evidence_present,null);
});
test('simplification: return-funds alternative appears only for absent evidence and fans out safely',()=>{
 assert.ok(visible('return_money',{return_evidence:'no'}));assert.ok(!visible('return_money',{return_evidence:'yes'}));assert.ok(!visible('return_money',{}));
 const f=model({return_evidence:'no',return_money:'yes'});assert.equal(f.supporting_evidence.financial_means.return_funds_evidence_present,true);assert.equal(f.supporting_evidence.return_or_onward_evidence.funds_to_acquire_return_present,true);
});
test('simplification: sponsorship evidence follows sponsorship, not all applicants',()=>{
 assert.ok(visible('sponsor',{sponsored:'yes'}));assert.ok(!visible('sponsor',{sponsored:'no'}));assert.ok(!visible('sponsor',{}));
});
test('simplification: accommodation alternatives follow relevant absent evidence',()=>{
 assert.ok(visible('accommodation_means',{accommodation:'HOTEL',accommodation_evidence:'no'}));
 assert.ok(visible('accommodation_means',{accommodation:'PRIVATE_HOST',attestation:'no'}));
 assert.ok(!visible('accommodation_means',{accommodation:'PRIVATE_HOST',attestation:'yes',accommodation_evidence:'no'}));
 assert.ok(!visible('accommodation_means',{accommodation:'HOTEL',accommodation_evidence:'yes'}));
});
test('simplification: purpose evidence and file assembly remain semantically distinct',()=>{
 assert.equal(fields.find(f=>f.id==='purpose_evidence').section,'Documents & Finances');
 assert.equal(fields.find(f=>f.id==='supporting_prepared').section,'Application Preparation');
 const f=model({purpose_evidence:'yes',supporting_prepared:'NEITHER'});assert.equal(f.supporting_evidence.purpose.evidence_present,true);assert.equal(f.supporting_evidence.application_file.supporting_originals_present,false);
});
test('simplification: grouped originals/copies preserves every combination',()=>{
 for(const [answer,expected] of [['BOTH',[true,true]],['ORIGINALS',[true,false]],['COPIES',[false,true]],['NEITHER',[false,false]],['',[null,null]]]){const f=model({supporting_prepared:answer}).supporting_evidence.application_file;assert.deepEqual([f.supporting_originals_present,f.supporting_copies_present],expected);}
});
test('simplification: qualifying photo count replaces duplicate confirmation without inventing zero',()=>{
 const f=model({photos:'2'}).supporting_evidence.application_file;assert.equal(f.identity_photo_count,2);assert.equal(f.identity_photos_qualifying_confirmed,true);
 assert.equal(model({photos:''}).supporting_evidence.application_file.identity_photos_qualifying_confirmed,null);
 assert.equal(model({photos:'0'}).supporting_evidence.application_file.identity_photo_count,0);
});
test('simplification: submitted and planned lodging fields are mutually conditional',()=>{
 for(const [submitted,actual,planned] of [['yes',true,false],['no',false,true],['',false,false]]){assert.equal(visible('actual_lodging',{submitted}),actual);assert.equal(visible('intended_lodging',{submitted}),planned);}
});
test('simplification: lodging reference events never substitute for one another',()=>{
 const values={submitted:'yes',actual_lodging:'2030-04-01',intended_lodging:'2029-04-01'};
 assert.equal(model(values).application.intended_lodging_date,null);assert.equal(model(values).application.lodging_date,'2030-04-01');
 values.submitted='no';assert.equal(model(values).application.lodging_date,null);assert.equal(model(values).application.intended_lodging_date,'2029-04-01');
});
test('simplification: planned-date path still executes earliest-lodging rule',()=>{
 const r=evaluate(adapt({...profile,submitted:'no',intended_lodging:'2030-04-01'},fields,config),config,assets);
 assert.equal(r.legal.find(x=>x.rule_id==='SCHENGEN_EARLIEST_LODGING').status,'PASS');assert.equal(r.legal.find(x=>x.rule_id==='SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE').status,'UNKNOWN');
});
test('simplification: completeness only appears after a stay and still requires confirmation',()=>{
 assert.ok(!visible('history_complete',{history:'yes',stays:[]}));assert.ok(visible('history_complete',{history:'yes',stays:[stay]}));
 assert.equal(model({history:'yes',stays:[stay]}).trip.stay_history_status,'INCOMPLETE');assert.equal(model({history:'yes',stays:[stay],history_complete:'yes'}).trip.stay_history_status,'COMPLETE');
});
test('simplification: insurance details only visible with insurance Yes',()=>{
 for(const id of ['amount','currency','insurance_from','insurance_to','territorial','repatriation','emergency','hospital']){assert.ok(visible(id,{insurance:'yes'}));for(const insurance of ['no','','unsure'])assert.ok(!visible(id,{insurance}));}
});
test('simplification: emergency and hospital remain independent OR inputs',()=>{
 const f=model({insurance:'yes',emergency:'no',hospital:'yes'}).supporting_evidence.travel_medical_insurance;assert.equal(f.emergency_medical_covered,false);assert.equal(f.hospital_treatment_covered,true);
});
test('simplification: private host shows attestation then original; hotel hides both',()=>{
 assert.ok(visible('attestation',{accommodation:'PRIVATE_HOST'}));assert.ok(!visible('attestation_original',{accommodation:'PRIVATE_HOST'}));assert.ok(visible('attestation_original',{accommodation:'PRIVATE_HOST',attestation:'yes'}));assert.ok(!visible('attestation',{accommodation:'HOTEL'}));
});
test('simplification: private-host evidence feeds accommodation readiness without hotel question',()=>{
 const f=model({accommodation:'PRIVATE_HOST',attestation:'yes'}).supporting_evidence.accommodation;assert.equal(f.evidence_present,true);assert.equal(f.private_host_attestation_original_present,null);
 assert.equal(model({accommodation:'PRIVATE_HOST',attestation:'no'}).supporting_evidence.accommodation.private_host_attestation_original_present,false);
});
test('simplification: biometrics details follow previous collection only',()=>{
 for(const id of ['bio_date','reuse']){assert.ok(visible(id,{previous_bio:'yes'}));assert.ok(!visible(id,{previous_bio:'no'}));assert.ok(!visible(id,{}));}
});
test('simplification: IRP flow reveals only relevant controls',()=>{
 assert.ok(!visible('irp',{}));assert.ok(visible('irp',{legal:'yes'}));assert.ok(!visible('irp_expiry',{legal:'yes',irp:'no'}));assert.ok(visible('irp_expiry',{legal:'yes',irp:'yes'}));assert.ok(!visible('irp_expiry',{legal:'no',irp:'yes'}));
});
test('simplification: renewal pending does not manufacture renewed status or expiry',()=>{
 const f=model({legal:'yes',renewal:'yes'}).residence;assert.equal(f.legal_status,'legal_resident');assert.equal(f.irish_irp_renewal_status,'PENDING');assert.equal(f.irish_residence_card_expiry_date,null);assert.equal(f.irish_permission_status,null);assert.equal(model({legal:'yes',renewal:'no'}).residence.irish_irp_renewal_status,'UNKNOWN');
});
test('simplification: completed and validated remain distinct, conditional facts',()=>{
 assert.ok(visible('validated',{completed:'yes'}));assert.ok(!visible('validated',{completed:'no'}));assert.equal(model({completed:'no',validated:'yes'}).application.france_visas_form_validated,null);
});
test('simplification stale: insurance details are ignored after Yes to No',()=>{
 const f=model({insurance:'no',amount:'50000',currency:'EUR',insurance_from:'2030-01-01',repatriation:'yes'}).supporting_evidence.travel_medical_insurance;
 assert.equal(f.present,false);for(const key of ['coverage_amount','currency','valid_from','medical_repatriation_covered'])assert.equal(f[key],null);
});
test('simplification stale: private host to hotel discards attestation',()=>{
 const f=model({accommodation:'HOTEL',attestation:'yes',attestation_original:'yes'}).supporting_evidence.accommodation;assert.equal(f.private_host_certificate_present,null);assert.equal(f.private_host_attestation_original_present,null);
});
test('simplification stale: travel Yes to No discards all old stays',()=>{
 const f=model({history:'no',history_complete:'yes',stays:[stay]}).trip;assert.equal(f.stay_history_status,'NONE');assert.deepEqual(f.schengen_stay_history,[]);
});
test('simplification stale: biometrics Yes to No discards collection and confirmation',()=>{
 const f=model({previous_bio:'no',bio_date:'2030-01-01',reuse:'yes'}).biometrics;assert.equal(f.previous_biometrics_date,null);assert.equal(f.reuse_confirmed,null);
});
test('simplification stale: sponsor Yes to No clears evidence without treating unsure as No',()=>{
 assert.equal(model({sponsored:'no',sponsor:'yes'}).supporting_evidence.financial_means.sponsorship_present,false);
 assert.equal(model({sponsored:'unsure',sponsor:'yes'}).supporting_evidence.financial_means.sponsorship_present,null);
});
test('simplification: unknown controller hides details without inventing false, zero or dates',()=>{
 const f=model({insurance:'unsure',amount:'0',legal:'unsure',irp:'yes',irp_expiry:'2030-01-01'});assert.equal(f.supporting_evidence.travel_medical_insurance.present,null);assert.equal(f.supporting_evidence.travel_medical_insurance.coverage_amount,null);assert.equal(f.residence.irish_residence_card_present,null);assert.equal(f.residence.irish_residence_card_expiry_date,null);
});
test('simplification: unanswered revealed fields remain null',()=>{
 const f=model({insurance:'yes',previous_bio:'yes',submitted:'yes'});assert.equal(f.supporting_evidence.travel_medical_insurance.coverage_amount,null);assert.equal(f.biometrics.previous_biometrics_date,null);assert.equal(f.application.lodging_date,null);
});
test('simplification: omitted technical inputs cannot override safe mappings',()=>{
 const f=model({...profile,issuer:'GB',regime:'invented',visa_type:'long_stay',territory:'overseas',ordinary:'yes',permission:'valid'});assert.equal(f.passport.issuing_country,'IN');assert.equal(f.trip.visa_type,'short_stay');assert.equal(f.residence.irish_permission_status,null);
});

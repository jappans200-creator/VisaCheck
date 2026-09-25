const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const { evaluate } = require('../../js/rules/evaluators.js');
test('generic relative date boundary supports explicit strict/inclusive comparisons',()=>{
  const p={actual_date:'2032-05-01',reference_date:'2032-01-01',amount:4,unit:'CALENDAR_MONTHS',calendar_policy:'CLAMP'};
  assert.equal(evaluate('relative_date_boundary',{...p,comparison:'LT'}).status,'FAIL');
  assert.equal(evaluate('relative_date_boundary',{...p,comparison:'GTE'}).status,'PASS');
  assert.equal(evaluate('relative_date_boundary',{...p,comparison:'OTHER'}).status,'UNKNOWN');
  assert.equal(evaluate('relative_date_boundary',{...p,comparison:'LT',actual_date:null}).status,'UNKNOWN');
});
test('procedure module runs as browser scripts without implicit current time',()=>{
  class NoClockDate extends Date{constructor(...a){if(!a.length)throw Error('No implicit clock');super(...a);}}
  const ctx=vm.createContext({Date:NoClockDate});
  for(const n of ['applicant-facts','evaluators','engine','application-procedure'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../js/rules',n+'.js'),'utf8'),ctx);
  ctx.c=fs.readFileSync(path.join(__dirname,'../../data/official-requirements/procedure-configurations/SCHENGEN_BIOMETRICS_PROCEDURE/0.1.0.json'),'utf8');
  const r=vm.runInContext("VisaCheckApplicationProcedure.evaluateBiometrics(VisaCheckApplicantFacts.normalizeApplicantFacts({trip:{visa_regime:'schengen',visa_type:'short_stay'},identity:{age:30},biometrics:{physical_impossibility_status:'NOT_DECLARED',previous_schengen_biometrics_present:true,previous_biometrics_date:'2030-01-01'},application:{lodging_date:'2034-12-01'}}),JSON.parse(c))",ctx);
  assert.equal(r.reuse_potential,false);
});

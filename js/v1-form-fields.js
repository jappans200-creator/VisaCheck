// Presentation vocabulary only. Legal thresholds remain in versioned definitions.
(function(root){
'use strict';
const fields=[
  {
    "section": "About You",
    "id": "nationality",
    "label": "Passport nationality",
    "type": "select",
    "options": [
      [
        "IN",
        "India"
      ],
      [
        "OTHER",
        "Other (unsupported)"
      ]
    ]
  },
  {
    "section": "About You",
    "id": "residence",
    "label": "Residence country",
    "type": "select",
    "path": "residence.country",
    "options": [
      [
        "IE",
        "Republic of Ireland"
      ],
      [
        "GB",
        "United Kingdom"
      ],
      [
        "OTHER",
        "Other"
      ]
    ]
  },
  {
    "section": "About You",
    "id": "age",
    "label": "Age on application date",
    "type": "number",
    "path": "identity.age"
  },
  {
    "id": "special",
    "section": "About You",
    "label": "Do any special circumstances below apply to your application?",
    "type": "boolean",
    "help": "Select Yes for family settlement or reunification, EU-family/free-movement arrangements (including Stamp 4 EUFAM), seafarer travel, or another special visa category. Select No only if none apply; otherwise choose Unsure."
  },
  {
    "section": "Passport",
    "id": "document",
    "label": "Document type",
    "type": "select",
    "path": "passport.document_type",
    "options": [
      [
        "ordinary",
        "Ordinary passport"
      ],
      [
        "diplomatic",
        "Diplomatic"
      ],
      [
        "OTHER",
        "Other"
      ]
    ]
  },
  {
    "section": "Passport",
    "id": "issue",
    "label": "Issue date",
    "type": "date",
    "path": "passport.issue_date"
  },
  {
    "section": "Passport",
    "id": "expiry",
    "label": "Expiry date",
    "type": "date",
    "path": "passport.expiry_date"
  },
  {
    "section": "Passport",
    "id": "pages",
    "label": "Blank pages",
    "type": "number",
    "path": "passport.blank_pages"
  },
  {
    "section": "Your Trip",
    "id": "destination",
    "label": "Destination country",
    "type": "select",
    "path": "trip.destination_country",
    "options": [
      [
        "FR",
        "Metropolitan France \u2014 short visit"
      ],
      [
        "ES",
        "Spain (unsupported)"
      ],
      [
        "OTHER",
        "Other (unsupported)"
      ]
    ],
    "help": "This preview covers one short visit. France-only routing is not a general multi-country or long-stay assessment."
  },
  {
    "section": "Your Trip",
    "id": "purpose",
    "label": "Purpose",
    "type": "select",
    "path": "trip.purpose",
    "options": [
      [
        "tourism",
        "Tourism"
      ],
      [
        "private_visit",
        "Private visit \u2014 partial coverage"
      ]
    ]
  },
  {
    "section": "Your Trip",
    "id": "entry",
    "label": "Intended Schengen entry",
    "type": "date",
    "path": "trip.intended_entry_date"
  },
  {
    "section": "Your Trip",
    "id": "exit",
    "label": "Intended Schengen exit",
    "type": "date",
    "path": "trip.intended_exit_date"
  },
  {
    "section": "Your Trip",
    "id": "return",
    "label": "Return to Ireland",
    "type": "date",
    "path": "trip.intended_return_to_ireland_date"
  },
  {
    "section": "Your Trip",
    "id": "activity",
    "label": "Will you do any paid or professional work during this trip?",
    "type": "boolean",
    "path": "trip.professional_activity_planned"
  },
  {
    "id": "other_schengen",
    "section": "Your Trip",
    "label": "Will you visit any other Schengen countries on this trip?",
    "type": "boolean"
  },
  {
    "section": "Irish Residence",
    "id": "legal",
    "label": "Are you currently legally resident in Ireland?",
    "type": "boolean",
    "options": [
      [
        "legal_resident",
        "Yes"
      ],
      [
        "not_legal_resident",
        "No"
      ]
    ]
  },
  {
    "section": "Irish Residence",
    "id": "irp",
    "label": "Do you have a current Irish Residence Permit (IRP) card?",
    "type": "boolean",
    "path": "residence.irish_residence_card_present",
    "when": [
      "legal",
      "yes"
    ],
    "help": "Answer about the physical card you hold. Validity is checked from its printed expiry date."
  },
  {
    "section": "Irish Residence",
    "id": "irp_expiry",
    "label": "IRP expiry date",
    "type": "date",
    "path": "residence.irish_residence_card_expiry_date",
    "when": [
      "irp",
      "yes"
    ],
    "help": "Use the expiry date printed on your current IRP card."
  },
  {
    "section": "Irish Residence",
    "id": "renewal",
    "label": "Is an IRP renewal currently pending?",
    "type": "boolean",
    "when": [
      "legal",
      "yes"
    ],
    "help": "A pending renewal does not establish a new expiry date or valid renewed permission."
  },
  {
    "id": "origin_details",
    "section": "Irish Residence",
    "label": "Add optional details for the IRP post-return validity check?",
    "type": "boolean",
    "when": [
      "irp",
      "yes"
    ],
    "help": "One existing check depends on country of origin, which cannot be inferred from passport nationality. Skip this to leave that check unknown."
  },
  {
    "section": "Irish Residence",
    "id": "origin",
    "label": "Country of origin for this optional check",
    "type": "select",
    "path": "identity.country_of_origin",
    "options": [
      [
        "IN",
        "India"
      ],
      [
        "IE",
        "Ireland"
      ],
      [
        "GB",
        "United Kingdom"
      ],
      [
        "FR",
        "France"
      ]
    ],
    "when": [
      "origin_details",
      "yes"
    ]
  },
  {
    "section": "Previous Schengen Travel",
    "id": "history",
    "label": "Have you spent any time in the Schengen Area during the 180 days before this planned trip?",
    "type": "boolean",
    "help": "Include previous short visits to countries in the Schengen Area. For each stay, select the authorization used."
  },
  {
    "section": "Previous Schengen Travel",
    "id": "history_complete",
    "label": "Have you included all of your Schengen stays from this period?",
    "type": "boolean",
    "when": {
      "all": [
        [
          "history",
          "yes"
        ],
        [
          "$has_stays",
          true
        ]
      ]
    },
    "placement": "after_stays"
  },
  {
    "section": "Accommodation",
    "id": "accommodation",
    "label": "Accommodation type",
    "type": "select",
    "path": "supporting_evidence.accommodation.type",
    "options": [
      [
        "HOTEL",
        "Hotel"
      ],
      [
        "PRIVATE_HOST",
        "Private host"
      ],
      [
        "OTHER",
        "Other"
      ]
    ]
  },
  {
    "section": "Accommodation",
    "id": "accommodation_evidence",
    "label": "Do you have accommodation evidence or a reservation?",
    "type": "boolean",
    "path": "supporting_evidence.accommodation.evidence_present",
    "when": [
      "accommodation",
      [
        "HOTEL",
        "OTHER"
      ]
    ]
  },
  {
    "section": "Accommodation",
    "id": "attestation",
    "label": "Is your attestation d\u2019accueil available?",
    "type": "boolean",
    "path": "supporting_evidence.accommodation.private_host_certificate_present",
    "when": [
      "accommodation",
      "PRIVATE_HOST"
    ]
  },
  {
    "section": "Accommodation",
    "id": "attestation_original",
    "label": "Is the original attestation available?",
    "type": "boolean",
    "path": "supporting_evidence.accommodation.private_host_attestation_original_present",
    "when": [
      "attestation",
      "yes"
    ]
  },
  {
    "section": "Accommodation",
    "id": "accommodation_means",
    "label": "Do you have alternative evidence of means to cover your accommodation?",
    "type": "boolean",
    "path": "supporting_evidence.accommodation.means_to_cover_evidence_present",
    "when": {
      "any": [
        [
          "accommodation_evidence",
          "no"
        ],
        [
          "attestation",
          "no"
        ]
      ]
    }
  },
  {
    "section": "Accommodation",
    "id": "accommodation_from",
    "label": "Accommodation coverage starts",
    "type": "date",
    "path": "supporting_evidence.accommodation.coverage_start",
    "when": {
      "any": [
        [
          "accommodation_evidence",
          "yes"
        ],
        [
          "attestation",
          "yes"
        ]
      ]
    }
  },
  {
    "section": "Accommodation",
    "id": "accommodation_to",
    "label": "Accommodation coverage ends",
    "type": "date",
    "path": "supporting_evidence.accommodation.coverage_end",
    "when": {
      "any": [
        [
          "accommodation_evidence",
          "yes"
        ],
        [
          "attestation",
          "yes"
        ]
      ]
    }
  },
  {
    "section": "Travel Insurance",
    "id": "insurance",
    "label": "Do you have travel medical insurance for this trip?",
    "type": "boolean",
    "path": "supporting_evidence.travel_medical_insurance.present"
  },
  {
    "section": "Travel Insurance",
    "id": "amount",
    "label": "Actual policy coverage amount",
    "type": "number",
    "path": "supporting_evidence.travel_medical_insurance.coverage_amount",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "currency",
    "label": "Coverage currency",
    "type": "select",
    "path": "supporting_evidence.travel_medical_insurance.currency",
    "options": [
      [
        "EUR",
        "EUR"
      ],
      [
        "USD",
        "USD"
      ],
      [
        "INR",
        "INR"
      ],
      [
        "GBP",
        "GBP"
      ]
    ],
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "insurance_from",
    "label": "Policy valid from",
    "type": "date",
    "path": "supporting_evidence.travel_medical_insurance.valid_from",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "insurance_to",
    "label": "Policy valid to",
    "type": "date",
    "path": "supporting_evidence.travel_medical_insurance.valid_to",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "territorial",
    "label": "Covers Schengen territory",
    "type": "select",
    "path": "supporting_evidence.travel_medical_insurance.territorial_scope",
    "options": [
      [
        "SCHENGEN",
        "Yes"
      ],
      [
        "OTHER",
        "No"
      ]
    ],
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "repatriation",
    "label": "Medical repatriation",
    "type": "boolean",
    "path": "supporting_evidence.travel_medical_insurance.medical_repatriation_covered",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "emergency",
    "label": "Emergency medical coverage",
    "type": "boolean",
    "path": "supporting_evidence.travel_medical_insurance.emergency_medical_covered",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Travel Insurance",
    "id": "hospital",
    "label": "Hospital treatment",
    "type": "boolean",
    "path": "supporting_evidence.travel_medical_insurance.hospital_treatment_covered",
    "when": [
      "insurance",
      "yes"
    ]
  },
  {
    "section": "Documents & Finances",
    "id": "finance",
    "label": "Do you have financial evidence available?",
    "type": "boolean",
    "path": "supporting_evidence.financial_means.evidence_present"
  },
  {
    "id": "sponsored",
    "section": "Documents & Finances",
    "label": "Will someone else sponsor or pay for your trip?",
    "type": "boolean",
    "help": "Only answer about sponsorship for this trip; having your own financial evidence does not rule it out."
  },
  {
    "section": "Documents & Finances",
    "id": "sponsor",
    "label": "Do you have evidence of that sponsorship?",
    "type": "boolean",
    "path": "supporting_evidence.financial_means.sponsorship_present",
    "when": [
      "sponsored",
      "yes"
    ]
  },
  {
    "section": "Documents & Finances",
    "id": "return_evidence",
    "label": "Do you have evidence of your return or onward travel?",
    "type": "boolean",
    "path": "supporting_evidence.return_or_onward_evidence.return_or_onward_evidence_present",
    "help": "For example, a reservation, ticket or other travel confirmation. Funds are asked about separately only if this evidence is absent."
  },
  {
    "id": "return_money",
    "section": "Documents & Finances",
    "label": "Do you have evidence of funds to pay for return or onward travel?",
    "type": "boolean",
    "when": [
      "return_evidence",
      "no"
    ]
  },
  {
    "section": "Documents & Finances",
    "id": "itinerary",
    "label": "Do you have a travel itinerary?",
    "type": "boolean",
    "path": "supporting_evidence.return_or_onward_evidence.itinerary_present"
  },
  {
    "section": "Documents & Finances",
    "id": "purpose_evidence",
    "label": "Do you have documents showing the purpose of your trip?",
    "type": "boolean",
    "path": "supporting_evidence.purpose.evidence_present"
  },
  {
    "section": "Documents & Finances",
    "id": "intention",
    "label": "Do you have information or documents supporting your intention to leave?",
    "type": "boolean",
    "path": "supporting_evidence.intention_to_leave.evidence_present",
    "help": "Evidence presence does not determine whether the consulate accepts it."
  },
  {
    "id": "community_details",
    "section": "Documents & Finances",
    "label": "Add optional details for the separate community comparison?",
    "type": "boolean"
  },
  {
    "section": "Documents & Finances",
    "id": "visited",
    "label": "Number of countries previously visited",
    "type": "number",
    "when": [
      "community_details",
      "yes"
    ]
  },
  {
    "section": "Documents & Finances",
    "id": "refusal",
    "label": "Previous visa refusal",
    "type": "boolean",
    "when": [
      "community_details",
      "yes"
    ]
  },
  {
    "section": "Documents & Finances",
    "id": "other_visas",
    "label": "Other visas, comma separated; enter None only if none",
    "type": "text",
    "when": [
      "community_details",
      "yes"
    ]
  },
  {
    "section": "Biometrics",
    "id": "previous_bio",
    "label": "Have you previously provided fingerprints for a Schengen visa?",
    "type": "boolean",
    "path": "biometrics.previous_schengen_biometrics_present",
    "help": "This means the date fingerprints were collected, not the visa issue date."
  },
  {
    "section": "Biometrics",
    "id": "bio_date",
    "label": "Previous collection date (not visa issue date)",
    "type": "date",
    "path": "biometrics.previous_biometrics_date",
    "when": [
      "previous_bio",
      "yes"
    ]
  },
  {
    "section": "Biometrics",
    "id": "reuse",
    "label": "Has reuse of those biometrics been confirmed for this application?",
    "type": "boolean",
    "path": "biometrics.reuse_confirmed",
    "when": [
      "previous_bio",
      "yes"
    ],
    "help": "A recent collection date does not guarantee reuse."
  },
  {
    "section": "Biometrics",
    "id": "physical",
    "label": "Have you declared a physical reason you cannot provide fingerprints?",
    "type": "select",
    "path": "biometrics.physical_impossibility_status",
    "options": [
      [
        "DECLARED",
        "Yes"
      ],
      [
        "NOT_DECLARED",
        "No"
      ]
    ]
  },
  {
    "section": "Biometrics",
    "id": "exemption",
    "label": "Have you declared another fingerprint exemption?",
    "type": "select",
    "path": "biometrics.fingerprint_exemption_status",
    "options": [
      [
        "DECLARED",
        "Yes"
      ],
      [
        "NOT_DECLARED",
        "No"
      ]
    ]
  },
  {
    "section": "Application Preparation",
    "id": "completed",
    "label": "Have you completed your France-Visas online application?",
    "type": "boolean",
    "path": "application.france_visas_form_completed"
  },
  {
    "section": "Application Preparation",
    "id": "validated",
    "label": "Has the application been validated or finalized?",
    "type": "boolean",
    "path": "application.france_visas_form_validated",
    "when": [
      "completed",
      "yes"
    ]
  },
  {
    "section": "Application Preparation",
    "id": "form_document",
    "label": "Do you have the completed application form ready for submission?",
    "type": "boolean",
    "path": "supporting_evidence.application_file.form_present",
    "when": [
      "completed",
      "yes"
    ],
    "help": "Completing the online form does not confirm that you have its submission copy."
  },
  {
    "section": "Application Preparation",
    "id": "receipt",
    "label": "Do you have your application receipt?",
    "type": "boolean",
    "path": "supporting_evidence.application_file.receipt_present"
  },
  {
    "section": "Application Preparation",
    "id": "original",
    "label": "Is your original passport available?",
    "type": "boolean",
    "path": "supporting_evidence.application_file.passport_original_present"
  },
  {
    "section": "Application Preparation",
    "id": "copy",
    "label": "Do you have a copy of your passport?",
    "type": "boolean",
    "path": "supporting_evidence.application_file.passport_copy_present"
  },
  {
    "section": "Application Preparation",
    "id": "photos",
    "label": "How many recent, qualifying ICAO-format identity photos do you have?",
    "type": "number",
    "path": "supporting_evidence.application_file.identity_photo_count",
    "help": "Count only photos you confirm meet these requirements. Leave blank if unsure."
  },
  {
    "id": "supporting_prepared",
    "section": "Application Preparation",
    "label": "Which requested supporting documents have you prepared?",
    "type": "select",
    "options": [
      [
        "BOTH",
        "All required originals and copies"
      ],
      [
        "ORIGINALS",
        "All originals, but copies are missing"
      ],
      [
        "COPIES",
        "All copies, but originals are missing"
      ],
      [
        "NEITHER",
        "Neither originals nor copies"
      ]
    ],
    "help": "Use your personal France-Visas checklist. This concerns the assembled application file, not just evidence of your trip\u2019s purpose."
  },
  {
    "section": "Application Preparation",
    "id": "appointment",
    "label": "Have you booked your appointment?",
    "type": "boolean",
    "path": "application.appointment_booked"
  },
  {
    "section": "Application Preparation",
    "id": "submitted",
    "label": "Have you already submitted or lodged this visa application?",
    "type": "boolean",
    "path": "application.submission_completed"
  },
  {
    "section": "Application Preparation",
    "id": "intended_lodging",
    "label": "Planned application / lodging date",
    "type": "date",
    "path": "application.intended_lodging_date",
    "when": [
      "submitted",
      "no"
    ]
  },
  {
    "section": "Application Preparation",
    "id": "actual_lodging",
    "label": "Date the application was lodged",
    "type": "date",
    "path": "application.lodging_date",
    "when": [
      "submitted",
      "yes"
    ]
  },
  {
    "section": "Application Preparation",
    "id": "envelope",
    "label": "Return envelope ready (current process \u2014 verification pending)",
    "type": "boolean",
    "path": "application.return_envelope_ready"
  },
  {
    "section": "Application Preparation",
    "id": "languages",
    "label": "Document languages, separated by commas (e.g. English, French)",
    "type": "languages",
    "path": "supporting_evidence.application_file.document_languages"
  }
];
if(typeof module==='object'&&module.exports)module.exports=fields;else root.VisaCheckV1Fields=fields;
})(globalThis);

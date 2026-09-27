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
    "section": "Trip",
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
    "section": "Trip",
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
    "section": "Trip",
    "id": "entry",
    "label": "Intended Schengen entry",
    "type": "date",
    "path": "trip.intended_entry_date"
  },
  {
    "section": "Trip",
    "id": "exit",
    "label": "Intended Schengen exit",
    "type": "date",
    "path": "trip.intended_exit_date"
  },
  {
    "section": "Residence",
    "id": "irp",
    "label": "Do you have a valid Irish Residence Permit (IRP)?",
    "type": "boolean",
    "when": [
      "residence",
      "IE"
    ],
    "help": "For this ordinary Ireland-resident preview, Yes declares a valid IRP. No may mean no card or an expired card; it does not establish your legal residence status."
  },
  {
    "section": "Residence",
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
    "section": "Travel History",
    "id": "history",
    "label": "Have you spent any time in the Schengen Area during the 180 days before this planned trip?",
    "type": "boolean",
    "help": "Include previous short visits to countries in the Schengen Area. For each stay, select the authorization used."
  },
  {
    "section": "Travel History",
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
    "section": "Travel Insurance",
    "id": "insurance",
    "label": "Do you have Schengen travel insurance that covers your full trip?",
    "type": "boolean",
    "help": "This is a readiness declaration. Detailed policy limits, dates and benefits are not verified by this answer. No may also mean an existing policy does not cover the full trip."
  },
  {
    "section": "Finances & Evidence",
    "id": "finance",
    "label": "Do you have financial evidence available?",
    "type": "boolean",
    "path": "supporting_evidence.financial_means.evidence_present"
  },
  {
    "id": "sponsored",
    "section": "Finances & Evidence",
    "label": "Will someone else sponsor or pay for your trip?",
    "type": "boolean",
    "help": "Only answer about sponsorship for this trip; having your own financial evidence does not rule it out."
  },
  {
    "section": "Finances & Evidence",
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
    "section": "Finances & Evidence",
    "id": "return_evidence",
    "label": "Do you have evidence of your return or onward travel?",
    "type": "boolean",
    "path": "supporting_evidence.return_or_onward_evidence.return_or_onward_evidence_present",
    "help": "For example, a reservation, ticket or other travel confirmation. Funds are asked about separately only if this evidence is absent."
  },
  {
    "id": "return_money",
    "section": "Finances & Evidence",
    "label": "Do you have evidence of funds to pay for return or onward travel?",
    "type": "boolean",
    "when": [
      "return_evidence",
      "no"
    ]
  },
  {
    "section": "Finances & Evidence",
    "id": "itinerary",
    "label": "Do you have a travel itinerary?",
    "type": "boolean",
    "path": "supporting_evidence.return_or_onward_evidence.itinerary_present"
  },
  {
    "section": "Finances & Evidence",
    "id": "purpose_evidence",
    "label": "Do you have documents showing the purpose of your trip?",
    "type": "boolean",
    "path": "supporting_evidence.purpose.evidence_present"
  },
  {
    "section": "Finances & Evidence",
    "id": "intention",
    "label": "Do you have information or documents supporting your intention to leave?",
    "type": "boolean",
    "path": "supporting_evidence.intention_to_leave.evidence_present",
    "help": "Evidence presence does not determine whether the consulate accepts it."
  },
  {
    "id": "community_details",
    "section": "Finances & Evidence",
    "label": "Add optional details for the separate community comparison?",
    "type": "boolean"
  },
  {
    "section": "Finances & Evidence",
    "id": "visited",
    "label": "Number of countries previously visited",
    "type": "number",
    "when": [
      "community_details",
      "yes"
    ]
  },
  {
    "section": "Finances & Evidence",
    "id": "refusal",
    "label": "Previous visa refusal",
    "type": "boolean",
    "when": [
      "community_details",
      "yes"
    ]
  },
  {
    "section": "Finances & Evidence",
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
    ],
    "help": "Optional collection date. Reuse remains subject to the application procedure; a recent date does not guarantee it."
  }
];
if(typeof module==='object'&&module.exports)module.exports=fields;else root.VisaCheckV1Fields=fields;
})(globalThis);

// the verification lock and the verified-only commission start on fixed dates. a suite run after them must not
// change what every older test expects, so tests opt in by setting these themselves.
process.env.VERIFY_REQUIRED_FROM = process.env.VERIFY_REQUIRED_FROM || "2100-01-01T00:00:00Z";
process.env.REFERRAL_VERIFIED_FROM = process.env.REFERRAL_VERIFIED_FROM || "2100-01-01T00:00:00Z";
process.env.REFERRAL_EDGE_FROM = process.env.REFERRAL_EDGE_FROM || "2100-01-01T00:00:00Z";
// predictions counting at resolution has no older behaviour worth keeping in a test, so the suite always runs under it
process.env.PREDICTION_STAKE_FROM = process.env.PREDICTION_STAKE_FROM || "2000-01-01T00:00:00Z";

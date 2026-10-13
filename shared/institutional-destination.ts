import { z } from "zod";

// ISO 3166-1 countries and territories; these are destinations, not supported
// providers or a statement of regulatory/settlement coverage.
export const DESTINATION_COUNTRIES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
const names = new Intl.DisplayNames(["en"], { type: "region" });
export const destinationCountryName = (code: string) => names.of(code) || code;

const field = (label: string, max: number) => z.string()
  .trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), `${label} contains invalid characters`);

export const institutionalDestinationSchema = z.object({
  institutionName: field("Institution name", 200),
  institutionAccountNumber: field("Receiving account or portfolio ID", 100),
  institutionCountry: z.string().refine(code => DESTINATION_COUNTRIES.includes(code), "Select a destination country"),
  destinationDetails: z.string().trim().max(1000, "Destination details must be 1000 characters or fewer")
    .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Destination details contain invalid characters")
    .optional().default(""),
  accountHolderType: z.enum(["own", "other"]).default("own"),
  accountHolderName: field("Account holder name", 200).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.accountHolderType === "other" && !data.accountHolderName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountHolderName"], message: "Account holder name is required" });
  }
});

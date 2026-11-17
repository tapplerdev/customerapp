import moment from "moment"

/*
 * Loads moment's Arabic locale without making it the app's global one.
 *
 * Importing `moment/locale/ar` runs moment's defineLocale, which registers the
 * locale AND switches the global locale to it. Imported where a chat bubble
 * is first drawn, that flipped every later `moment().format()` in the app to
 * Arabic, English users included (NotificationItem, OfferHistorySheet,
 * RequestSummaryScreen's deadline). So the locale is loaded here, and the
 * global one is put straight back.
 *
 * A date that should read Arabic asks for it where it is formatted, as
 * proapp does: `moment(x).locale(isAr ? "ar" : "en").format(...)`. Import this
 * module from any file that does, never `moment/locale/ar` itself.
 */
const appLocale = moment.locale()
// A require, not an import: an import is hoisted above `appLocale`, which has to
// be read before the locale loads.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("moment/locale/ar")
moment.locale(appLocale)

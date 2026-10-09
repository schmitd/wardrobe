# Optional city weather

The review candidate replaces disabled Open-Meteo retrieval with a server-side
MET Norway Locationforecast 2.0 adapter. No account, API key, paid provider,
GPS permission, IP geolocation, or background weather requests are added.
Selecting a city does not fetch; explicitly requesting outfits does.

MET Norway permits reuse under CC BY 4.0 / NLOD 2.0. The adapter uses the
existing public privacy contact and app domain in its identifying User-Agent,
rounded city coordinates, Expires and If-Modified-Since caching, request
coalescing, a 3.5-second timeout, fixed HTTPS origin and no redirects. Provider
failures have a ten-minute cooldown. Cache entries are public forecasts keyed
by a finite city catalog, never account/session data. No provider payload is
logged. Caller interruption prevents planning commits; a shared, bounded
public forecast request may finish and populate the cache after interruption.

Forecast timestamps are grouped in the selected city's IANA timezone,
including DST. Temperature ranges summarize forecast samples, not exact daily
extrema. Maximum period rain probability is explicitly labeled; absent/null
probability remains unavailable and precipitation amount is never interpreted
as probability. Forecasts older than six hours are rejected. Days outside the
provider forecast horizon retain practical layering/rain fallback.

The provider covers global coordinates, but this candidate's **city catalog is
limited to six verified GeoNames records**: Charlotte (4460243), London
(2643743), Moscow (524901), New York City (5128581), Paris (2988507), and Sydney
(2147714). No default city is selected or inferred. Other cities must skip
weather for now. The full GeoNames dataset download was blocked in this cloud
environment; broader city coverage remains open. Records use GeoNames CC BY
4.0 data, checked on 2026-10-07 at `https://www.geonames.org/{id}/`, with
coordinates rounded to two decimals. UI attribution links GeoNames, MET
Norway, and the license and describes the transformations.

Real API reachability is **unverified**: the environment proxy rejected the
MET Norway and GeoNames dataset connections with `Tunnel connection failed:
403 Forbidden`. Mock transport/parser tests are not evidence of live delivery.
No production provider flag or configuration has been changed. Verify server
reachability and forecasts for explicitly selected cities before release.

The process-local cache is bounded for this catalog. Before significant
multi-instance traffic, add shared public-forecast caching and rate control;
MET Norway requires agreement above 20 application requests/second and offers
no delivery SLA. Respect throttling and Retry-After if provider policy changes.

Primary references:

- https://docs.api.met.no/doc/License.html
- https://docs.api.met.no/doc/TermsOfService.html
- https://api.met.no/weatherapi/locationforecast/2.0/documentation
- https://www.geonames.org/export/
- https://creativecommons.org/licenses/by/4.0/

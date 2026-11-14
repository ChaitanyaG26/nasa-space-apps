# Publish LUNA through GitHub Pages and Porkbun

## Hosting architecture

GitHub Pages is static-only: it does not execute FastAPI or Python. This repository includes a fully browser-side illustrative simulator for the globe, sidebar geometry previews, energy/battery graphs and compare modes. The offline results are NOT NASA-validated: they assume a flat terrain horizon, unverified astronomy and an unvalidated temperature response. Rover traversal and seismic analysis are not currently implemented.

For live JPL Horizons and LOLA modeling, deploy the Python backend separately or precompute validated science data and publish it as static files.

## Enable GitHub Pages

1. Merge the deployment pull request into the main branch.
2. Open https://github.com/ChaitanyaG26/nasa-space-apps/settings/pages
3. Set Build and deployment > Source to GitHub Actions.
4. Under Actions, run Deploy LUNA to GitHub Pages on main if the first publish was not triggered.
5. After the workflow succeeds, test https://chaitanyag26.github.io/nasa-space-apps/

The workflow builds project-relative links and publishes the website files only, not backend source code.

## Custom link through Porkbun (recommended: subdomain)

A name such as luna.example.com is safer than replacing an existing root-domain website.

1. At GitHub > Settings > Pages > Custom domain, enter your chosen name, e.g. luna.example.com, and Save. Do this BEFORE changing Porkbun DNS.
2. At Porkbun > Domain Management > Your domain > DNS Records, add:
   - Type: CNAME
   - Host: luna (or www if using www.example.com)
   - Answer/Value: ChaitanyaG26.github.io
   - TTL: default
3. Remove conflicting DNS records for the same host only; preserve email MX/SPF/DKIM records.
4. Do not include https:// or /nasa-space-apps in the DNS value.
5. Wait for GitHub's DNS validation and certificate issuance, then enable Enforce HTTPS.

DNS changes may take up to 24 hours to propagate.

### If you want example.com at the root (apex) instead

In GitHub Pages set the custom domain to example.com. Add four A records at Porkbun, each with Host @:

- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

Optionally add www as CNAME to ChaitanyaG26.github.io. Do not overwrite an active website's apex records unless intentionally moving it. Avoid wildcard DNS records.

### Verify and troubleshoot

- For CNAME: dig luna.example.com CNAME +short, or nslookup -type=CNAME luna.example.com
- For apex A: dig example.com A +short
- 404 on default URL: check Pages Source = GitHub Actions and the deploy workflow succeeded.
- 404 for CSS/JS: the build script must rewrite absolute asset paths to relative paths.
- Errors requesting /api: check the build-injected window.LUNA_STATIC_SITE flag and static-engine.mjs.
- HTTPS pending: inspect DNS for conflicts, then allow time for certificate issuance.
- The live NASA source option is disabled on static Pages; that is expected.
- Use account-level custom domain verification on GitHub to reduce domain takeover risk.

Official guidance:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
https://kb.porkbun.com/article/68-how-to-edit-dns-records
https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages

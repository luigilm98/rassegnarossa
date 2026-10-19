# Building Internazionale Rossa together

Anyone can propose a correction, a page change, a source, a book, a translation or a technical improvement. Write in any language. You do not need to code. Start with the [contribution guide](../CONTRIBUTING.md).

## Proposals and voting on the website

Open **Partecipa** on the website. Anyone can read proposals. Sign in with ChatGPT to publish a proposal or choose support, opposition or abstention; no GitHub account is required. Activists, journalists, collectives, trade unions and readers can contribute without declaring an affiliation. Professional status and identity are not verified.

Each account can hold one vote per proposal, change it or revoke it. Totals are public; individual choices and account details are not. Proposals and votes are stored on the server and survive browser-data deletion. Proposal authors may withdraw their text. Up to three proposals per account in 24 hours are allowed. Do not publish private information. Public proposal text may be sent to the translation service when readers request another language.

Votes help prioritise discussion. They are advisory and describe participating accounts, not the views of the worldwide left or verified unique people. An open proposal does not automatically change the website. Maintainers record decisions and explain their reasons.

### Recording decisions and moderation

A reviewed change to `app/data/community-decisions.json` records the decision under the proposal UUID. Each entry contains `status` (`open`, `planned`, `implemented`, `declined` or `hidden`), a public `reason`, an ISO date (`YYYY-MM-DD`) and an optional HTTPS `url` to the resulting change. Never put private account information in this file. Publishing the change applies the decision. Non-open proposals stop accepting new votes; existing voters may still revoke their choice.

Use `hidden` for spam, harassment or publication of private information, with a concise reason that does not repeat the offending material. Hidden proposals are removed from public results. This is maintainer moderation, not an automated verdict from vote totals. An empty file means no decisions have been recorded; the site does not generate example proposals or votes.

## From an idea to a published change

1. **Propose.** Open **Issues → New issue** and choose a form. A short description is enough to start. Blank issues remain available if none of the forms fits.
2. **Discuss.** Contributors and maintainers use the thread to clarify the need, check evidence and agree on a useful scope. A proposal can be accepted, revised, deferred or declined; the decision should be explained in the thread. There is no guaranteed response time.
3. **Prepare.** A contributor or maintainer prepares the text or code in a pull request. Small fixes can start directly as a pull request.
4. **Review.** Maintainers review the result, sources, usability and compatibility. Automated checks apply to code. A proposal does not change the live site by itself.
5. **Publish.** Maintainers merge accepted work and publish the Site through its separate deployment process. A merged pull request is not proof that the live site has already changed.

## A useful proposal

Name the page or feature, explain the desired change and give an example. For factual corrections or historical content, link documents that support the specific claim. For a new publisher or video channel, include the official address, language, country and feed when known. For a book, link the legitimate online edition and identify its language. For a translation, provide the current wording, your proposal and its context.

Political and historical contributions can have a clear viewpoint while keeping dates, quotations, attribution and measurements accurate. Distinguish a proposal, a law and an observed result. Explain disagreements through evidence and reasoning.

## Participation and privacy

Be welcoming to first-time contributors. Critique ideas and changes without personal attacks, harassment or discrimination. Keep discussions focused on the proposal and avoid duplicate issues.

Issues and pull requests are public. A GitHub username and contribution history may be visible. Do not post passwords, tokens, private email addresses, personal reading histories or identifiable screenshots. Remove personal information before attaching an example. Use a project identity and GitHub email-privacy settings if separating a contribution from a personal identity matters to you.

No contributor needs access to production accounts, secrets or other users’ collections. Ownership and permission to publish remain with the maintainers; opening a proposal does not grant deployment access.

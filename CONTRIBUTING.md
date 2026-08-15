# Contributing

Changes should preserve three boundaries: target text is untrusted, rejected values are not echoed in errors, and the library does not claim to make model output safe for every downstream use.

Please add a regression test, run `npm run check`, and explain the failure mode addressed by the change.

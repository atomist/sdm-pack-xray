# @atomist/sdm-pack-xray

[![atomist sdm goals](http://badge.atomist.com/T29E48P34/atomist/sdm-pack-xray/ee0b5cfb-6d9a-4fc3-98c8-40b5fd855884)](https://app.atomist.com/workspace/T29E48P34)
[![npm version](https://img.shields.io/npm/v/@atomist/sdm-pack-xray/next.svg)](https://www.npmjs.com/package/@atomist/sdm-pack-xray/v/next)

[Atomist][atomist] software delivery machine (SDM) extension Pack for an Atomist SDM to receive and act on JFrog Xray violation events.

See the [Atomist documentation][atomist-doc] for more information on
what SDMs are and what they can do for you using the Atomist API for
software.

## Usage

1. First install the dependency in your SDM project

```
$ npm install @atomist/sdm-pack-xray
```

2. Install the support

```
import { xraySupport } from "@atomist/sdm-pack-xray";

sdm.addExtensionPacks(
    xraySupport()
);
```

3. Add configuration to your client configuration

```
// no configuration needed
```

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/sdm-pack-spring/issues

## Development

You will need to install [Node][node] to build and test this project.

[node]: https://nodejs.org/ (Node.js)

### Build and test

Use the following package scripts to build, test, and perform other
development tasks.

Command | Reason
------- | ------
`npm install` | install project dependencies
`npm run build` | compile, test, lint, and generate docs
`npm run lint` | run TSLint against the TypeScript
`npm run compile` | generate types from GraphQL and compile TypeScript
`npm test` | run tests
`npm run autotest` | run tests every time a file changes
`npm run clean` | remove files generated during build

### Release

Releases are handled via the [Atomist SDM][atomist-sdm].  Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - Development Automation)
[slack]: https://join.atomist.com/ (Atomist Community Slack)

// A recorded fixture of the hfs-stack-tooling spec: plain data, exported as the default.
export default {
  "schema": "starci/stack-tooling-fixture@1",
  "description": "An app that re-implements deploy tooling: a render script and a host script named after verbs, docker swarm and stack calls, and a package script. All text is synthetic.",
  "files": {
    "hfs.json": {
      "hfs": 3,
      "kind": "app",
      "project": "shop"
    },
    "package.json": {
      "name": "shop",
      "scripts": {
        "deploy:status": "docker service ps shop_api"
      }
    },
    "deploy/swarm/render.mjs": "import { spawnSync } from 'node:child_process';\nspawnSync('docker', ['stack', 'config', '-c', 'stack.yaml']);\n",
    "deploy/swarm/vps.sh": "#!/usr/bin/env bash\nset -euo pipefail\ndocker swarm init\n",
    ".github/workflows/release.yml": "name: release\non: workflow_dispatch\njobs:\n  ship:\n    runs-on: ubuntu-latest\n    steps:\n      - run: docker stack deploy -c stack.yaml shop\n"
  },
  "expect": [
    {
      "path": "deploy/swarm/render.mjs",
      "verb": "render"
    },
    {
      "path": "deploy/swarm/vps.sh",
      "verb": "prepare"
    },
    {
      "path": "package.json",
      "verb": "converge"
    },
    {
      "path": ".github/workflows/release.yml",
      "verb": "deploy"
    }
  ]
};

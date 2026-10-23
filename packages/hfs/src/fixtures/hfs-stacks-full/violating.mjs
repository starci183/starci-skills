// A recorded fixture of the hfs-stacks-full spec: plain data, exported as the default.
export default {
  "schema": "starci/stacks-rule-fixture@1",
  "edition": "full",
  "description": "Violating full-edition Swarm evidence. Each expected code is emitted by the existing finder; all text is synthetic.",
  "files": {
    "hfs.json": {
      "hfs": 3,
      "kind": "app",
      "edition": "full",
      "project": "full-stacks-proof",
      "sides": {
        "be": {
          "apps": [
            {
              "name": "api",
              "kind": "api"
            },
            {
              "name": "cli",
              "kind": "cli"
            }
          ]
        },
        "fe": {
          "apps": []
        }
      }
    },
    ".starcistacks/application-stacks.yaml": {
      "schema": "starci/application-stacks@1",
      "components": {
        "api": {
          "role": "service",
          "image": "fixture/api:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        "ingress": {
          "role": "ingress",
          "image": "nginx:1.28.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        "automation": {
          "role": "sidecar",
          "image": "n8nio/n8n:1.64.3@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "database": {
            "provider": "sqlite",
            "volume": "automation-data"
          },
          "volumes": [
            "automation-data"
          ]
        },
        "report": {
          "role": "job",
          "mode": "replicated-job",
          "schedule": "0 3 * * *",
          "image": "fixture/cli:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        "preview": {
          "role": "ingress",
          "image": "caddy:2.10.2@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      },
      "backing": {
        "postgres": {
          "provider": "postgres",
          "managed": true
        }
      },
      "environments": {
        "production": {
          "status": "supported",
          "runtime": "docker-swarm",
          "composeFiles": [
            "infra/swarm/stack.yaml"
          ],
          "components": {
            "api": {},
            "ingress": {},
            "automation": {},
            "report": {},
            "preview": {}
          },
          "runbook": "README.md",
          "ingress": {
            "component": "ingress",
            "hosts": [
              "app.example.test"
            ]
          },
          "secrets": [
            {
              "name": "database-url",
              "runtimeName": "fixture-database-url-v1",
              "version": 1
            }
          ],
          "backup": [
            {
              "component": "automation",
              "target": "encrypted-offsite",
              "retention": "30d",
              "owner": "application operator"
            }
          ]
        }
      },
      "k8s": {
        "status": "deferred",
        "reason": "Isolated Swarm checker evidence"
      }
    },
    ".starcistacks/production/infra/swarm/stack.yaml": {
      "services": {
        "api": {
          "image": "fixture/api:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "deploy": {
            "replicas": 1,
            "rollback_config": {
              "order": "stop-first",
              "monitor": "30s"
            },
            "restart_policy": {
              "condition": "on-failure"
            }
          },
          "secrets": [
            "database-url"
          ],
          "environment": {
            "API_TOKEN": "synthetic-fixture-value"
          },
          "ports": [
            "3000:3000"
          ],
          "volumes": [
            "api-data:/data"
          ]
        },
        "ingress": {
          "image": "nginx:1.28.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "healthcheck": {
            "test": [
              "CMD-SHELL",
              "test -r /proc/1/status"
            ],
            "interval": "30s"
          },
          "deploy": {
            "replicas": 1,
            "update_config": {
              "order": "start-first",
              "failure_action": "rollback",
              "monitor": "30s"
            },
            "rollback_config": {
              "order": "stop-first",
              "monitor": "30s"
            },
            "restart_policy": {
              "condition": "on-failure"
            }
          },
          "ports": [
            {
              "published": 443,
              "target": 443,
              "mode": "ingress"
            }
          ]
        },
        "automation": {
          "image": "n8nio/n8n:1.64.3@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "healthcheck": {
            "test": [
              "CMD-SHELL",
              "test -r /proc/1/status"
            ],
            "interval": "30s"
          },
          "deploy": {
            "replicas": 1,
            "update_config": {
              "order": "start-first",
              "failure_action": "rollback",
              "monitor": "30s"
            },
            "rollback_config": {
              "order": "stop-first",
              "monitor": "30s"
            },
            "restart_policy": {
              "condition": "on-failure"
            },
            "placement": {
              "constraints": [
                "node.labels.storage == true"
              ]
            }
          },
          "volumes": [
            "automation-data:/data"
          ]
        },
        "report": {
          "image": "fixture/cli:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "healthcheck": {
            "test": [
              "CMD-SHELL",
              "test -r /proc/1/status"
            ],
            "interval": "30s"
          },
          "deploy": {
            "replicas": 1,
            "update_config": {
              "order": "start-first",
              "failure_action": "rollback",
              "monitor": "30s"
            },
            "rollback_config": {
              "order": "stop-first",
              "monitor": "30s"
            },
            "restart_policy": {
              "condition": "on-failure"
            },
            "mode": "replicated-job"
          },
          "command": [
            "node",
            "dist/apps/cli/main.js",
            "report"
          ]
        },
        "preview": {
          "image": "caddy:2.10.2@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "healthcheck": {
            "test": [
              "CMD-SHELL",
              "test -r /proc/1/status"
            ],
            "interval": "30s"
          },
          "deploy": {
            "replicas": 1,
            "update_config": {
              "order": "start-first",
              "failure_action": "rollback",
              "monitor": "30s"
            },
            "rollback_config": {
              "order": "stop-first",
              "monitor": "30s"
            },
            "restart_policy": {
              "condition": "on-failure"
            }
          }
        }
      },
      "secrets": {
        "database-url": {
          "external": false,
          "name": "fixture-database-url"
        }
      },
      "volumes": {
        "automation-data": {}
      }
    },
    "evidence/images.lock": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/current.json": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/previous.json": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/automation-restore.md": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/postgres-restore.md": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/dns.md": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n",
    "evidence/tls.md": "# Synthetic static-check fixture\n\nThis authored record exercises a required public evidence path. It claims no deployed release or completed operational restore.\n"
  },
  "expect": {
    "R266": [
      "STACKS_SECRET_NOT_EXTERNAL",
      "STACKS_SECRET_UNVERSIONED",
      "STACKS_SECRET_ENV_LITERAL",
      "STACKS_PORT_PUBLISHED",
      "STACKS_SECOND_INGRESS",
      "STACKS_DNS_UNDECLARED",
      "STACKS_HOST_UNROUTED",
      "STACKS_TLS_UNDECLARED",
      "STACKS_PLACEMENT_MISSING",
      "STACKS_HEALTHCHECK_MISSING",
      "STACKS_UPDATE_POLICY_MISSING"
    ],
    "R267": [
      "STACKS_RELEASE_UNDECLARED",
      "BACKUP_UNDECLARED",
      "BACKUP_PROOF_MISSING"
    ],
    "R268": [
      "HFS_SCHEDULE_UNDECLARED"
    ],
    "R275": [
      "STACKS_INGRESS_UNDECLARED",
      "STACKS_INGRESS_UNKNOWN"
    ]
  }
};

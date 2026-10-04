# Scalable Betting Platform

Serverless service that accepts bets for online casino games. It is built on AWS API Gateway, Lambda and DynamoDB, written in TypeScript, and runs locally against [MiniStack](https://github.com/ministackorg/ministack), a local AWS emulator.

It addresses a specific problem: a casino betting platform whose capacity is fixed cannot absorb the nightly peak between 22:00 and 00:00, which costs revenue and degrades the player experience. The design goal is a bet placement path with no fixed capacity anywhere, able to serve 2 million concurrent users.

## Overview

- **Two endpoints.** `POST /bets` places a bet and `POST /rounds` opens a new round for a game. Everything else a real platform needs (deposits, balances, settlement, authentication) is assumed to exist elsewhere and is out of scope.
- **Placing a bet is three steps:** validate that the game, round and odd exist, belong together and that the round is still accepting bets; debit the player's wallet through an external service; store the bet in DynamoDB.
- **Nothing in the path has fixed capacity.** API Gateway and Lambda scale with demand, the Lambda functions hold no state, and the bets table is partitioned by user so writes spread evenly.
- **A bet is never stored twice.** Each request carries an idempotency key, and a second bet with the same key from the same user is rejected as a duplicate.

## Architecture

### Placing a bet

```
Client
  │  POST /bets   headers: x-user-id, Idempotency-Key
  ▼
API Gateway (HTTP API)
  │
  ▼
Lambda  place-bet
  │
  ├─ 1. Validate headers and body
  │
  ├─ 2. Validate game, round and odd ──► in-memory cache ──(miss)──► DynamoDB  Games / Rounds / Odds
  │        round must be inside its betting window
  │
  ├─ 3. Debit the wallet ─────────────► Wallet service (external, simulated)
  │
  └─ 4. Conditional write ────────────► DynamoDB  Bets  (+ RoundOdds index)
           fails if the bet already exists
```

### Creating a round

```
Client
  │  POST /rounds   body: gameId
  ▼
API Gateway (HTTP API)
  │
  ▼
Lambda  create-round
  │
  ├─ 1. Validate that the game exists ─► DynamoDB  Games
  ├─ 2. Take the next round id ────────► DynamoDB  Counters  (atomic increment, one counter per game)
  └─ 3. Store the round ───────────────► DynamoDB  Rounds
```

Two things worth calling out. Validation runs first and is the only step that decides whether a bet is in time: once it passes, the bet is valid even if the betting window closes while the wallet is debited or the bet is written. And in steady state validation does not touch DynamoDB at all, because games, odds and rounds are served from the Lambda instance's memory; the only DynamoDB access that grows with traffic is the bet write itself.

## How it scales

The target of 2 million bets in the two-hour peak is an average of about 278 bets per second.

| Component   | Why it does not need capacity planning                                                                                          | Default limit                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| API Gateway | Managed, scales automatically                                                                                                   | 10,000 requests/s per account and region                                                           |
| Lambda      | One instance per concurrent request, created on demand. At 278 bets/s and ~100 ms per bet that is about 30 concurrent instances | 1,000 concurrent executions per account                                                            |
| DynamoDB    | On-demand billing, no provisioned throughput                                                                                    | A new on-demand table absorbs roughly 4,000 writes/s, and up to double its previous peak instantly |

Three properties of the code make this hold:

- **Stateless functions.** Each request is independent, so adding instances is all it takes to add capacity.
- **Writes spread by user.** The `Bets` table uses `userId` as partition key. A partition accepts about 1,000 writes per second, and no single user comes near that, so load distributes evenly instead of concentrating on a popular round.
- **One write and no read per bet.** Reference data is cached, and duplicates are detected by the write itself through a condition, not by a read beforehand.

What would have to change for a real peak well above the average: pre-warm the `Bets` table before 22:00 (the peak is predictable), raise the account quotas, and make sure the wallet service scales as far as this one does, since every bet calls it.

## Tech stack

| Layer              | Technology                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| Language / runtime | TypeScript 6 (strict), Node.js 22+                                       |
| Compute            | AWS Lambda, one function per endpoint                                    |
| API                | AWS API Gateway (HTTP API, Lambda proxy integration, payload format 2.0) |
| Database           | AWS DynamoDB, on-demand                                                  |
| AWS access         | AWS SDK for JavaScript v3                                                |
| Local AWS          | MiniStack 1.5.17 in Docker                                               |
| Build              | esbuild, one bundled file per function                                   |
| Tests              | Vitest (unit), autocannon (load)                                         |
| Code quality       | ESLint with type-aware strict rules, Prettier                            |

## API

| Method | Path      | Description                      |
| ------ | --------- | -------------------------------- |
| `POST` | `/bets`   | Place a bet on an odd of a round |
| `POST` | `/rounds` | Open a new round for a game      |

### Place a bet

```
POST /bets
x-user-id: user-1
Idempotency-Key: 4f6c1c0e-9d55-4c8e-9a37-0e3c6a2b7d11
Content-Type: application/json

{ "gameId": "1", "roundId": "1002", "oddId": "roulette-red", "betAmount": 10 }
```

- `x-user-id` identifies the player. It stands in for what an API Gateway authorizer would provide in production.
- `Idempotency-Key` identifies the bet and becomes its `betId`. The client generates it, one per bet the player intends to place, and reuses it when retrying. Up to 128 characters: letters, digits and `_ . : -`. A UUID fits.
- `oddId` identifies what is being bet on within the game, for example red or number 7 in roulette.
- `betAmount` must be a positive number.

Response `201 Created`:

```json
{
  "betId": "4f6c1c0e-9d55-4c8e-9a37-0e3c6a2b7d11",
  "userId": "user-1",
  "gameId": "1",
  "roundId": "1002",
  "oddId": "roulette-red",
  "betAmount": 10,
  "status": "ACCEPTED",
  "createdAt": "2026-10-04T22:00:10.000Z"
}
```

### Create a round

```
POST /rounds
Content-Type: application/json

{ "gameId": "1" }
```

The service sets everything else: the round starts when the request is received, accepts bets for 30 seconds, ends one minute after it starts, and has status `open`. Its id is the next number in that game's sequence.

Response `201 Created`:

```json
{
  "roundId": "1003",
  "gameId": "1",
  "startDate": "2026-10-04T22:00:00.000Z",
  "bettingDurationSeconds": 30,
  "endDate": "2026-10-04T22:01:00.000Z",
  "status": "open"
}
```

### Errors

Every error has the same shape. `details` is only present for invalid requests and lists every problem found.

```json
{ "error": { "code": "BETTING_WINDOW_CLOSED", "message": "Round 1003 is not accepting bets" } }
```

| Status | Code                    | Meaning                                                                     |
| ------ | ----------------------- | --------------------------------------------------------------------------- |
| `400`  | `INVALID_REQUEST`       | A header or field is missing or malformed, or the body is not a JSON object |
| `402`  | `INSUFFICIENT_FUNDS`    | The wallet service refused the debit                                        |
| `409`  | `DUPLICATE_BET`         | This user already placed a bet with this `Idempotency-Key`                  |
| `422`  | `GAME_NOT_FOUND`        | The game does not exist                                                     |
| `422`  | `ROUND_NOT_FOUND`       | The round does not exist for that game                                      |
| `422`  | `ODD_NOT_FOUND`         | The odd does not exist                                                      |
| `422`  | `ODD_GAME_MISMATCH`     | The odd belongs to a different game                                         |
| `422`  | `BETTING_WINDOW_CLOSED` | The round has not started yet, or its betting window is over                |
| `500`  | `INTERNAL_ERROR`        | Unexpected failure. Details go to the log, not to the response              |

A bet is in time when `startDate <= now < startDate + bettingDurationSeconds`, compared to the millisecond.

## Data model

| Table      | Key                  | Other attributes                                                                                    |
| ---------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `Games`    | `gameId`             | `name`                                                                                              |
| `Rounds`   | `gameId` + `roundId` | `startDate`, `bettingDurationSeconds`, `endDate`, `status` (`created`, `open`, `running`, `closed`) |
| `Odds`     | `oddId`              | `gameId`, `value` (readable name of what is bet on)                                                 |
| `Bets`     | `userId` + `betId`   | `gameId`, `roundId`, `oddId`, `betAmount`, `status`, `createdAt`, `roundShard`                      |
| `Counters` | `counterName`        | `currentValue` (last round id issued for a game)                                                    |

`Bets` also has a global secondary index, `RoundOdds`, keyed by `roundShard` + `oddId`. It is explained under [Design decisions](#design-decisions).

Dates are stored as ISO 8601 text in UTC with millisecond precision, for example `2026-10-04T22:00:00.000Z`.

## Running locally

### Prerequisites

- Docker Desktop (or another Docker engine), running
- Node.js 22 or later

### Quick start

```
npm install
cp .env.example .env
npm run local:setup
```

On Windows PowerShell use `Copy-Item .env.example .env` for the second line.

`local:setup` starts MiniStack, creates the tables, loads the seed data, bundles the two functions and deploys them with their API routes. It ends by printing the two URLs:

```
POST /bets: http://localhost:4566/_aws/execute-api/<apiId>/$default/bets
POST /rounds: http://localhost:4566/_aws/execute-api/<apiId>/$default/rounds
```

`$default` is the name of the API Gateway stage. MiniStack keeps all its state in memory, so restarting the container erases tables, data and deployment, and generates a new `<apiId>`. Run `npm run local:setup` again after every restart and use the URLs it prints.

### Seed data

| Game     | `gameId` | Odds                                                                                                                                                                                                        |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roulette | `1`      | `roulette-number-0` to `roulette-number-36`, `roulette-red`, `roulette-black`, `roulette-even`, `roulette-odd`, `roulette-low`, `roulette-high`, `roulette-dozen-1`, `roulette-dozen-2`, `roulette-dozen-3` |
| Baccarat | `2`      | `baccarat-player`, `baccarat-banker`, `baccarat-tie`                                                                                                                                                        |

| Round  | Game | Accepts bets for                |
| ------ | ---- | ------------------------------- |
| `1001` | `1`  | 30 seconds after the seed runs  |
| `1002` | `1`  | **30 days** after the seed runs |
| `2001` | `2`  | 30 seconds after the seed runs  |

**Round `1002` is a special round for testing.** Real rounds only accept bets for 30 seconds, which is too short to try things by hand or to run a load test. Round `1002` starts when the seed runs and both its betting window and its end date are one month later, so it can be bet on at any time. Use it whenever you just want a bet to be accepted.

`npm run db:seed` can be run again at any time. It refreshes the dates of the three seeded rounds and leaves other data untouched.

### Try it

PowerShell. Keep the URL in single quotes, otherwise PowerShell treats `$default` as a variable:

```powershell
$url = 'http://localhost:4566/_aws/execute-api/<apiId>/$default/bets'

Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json' `
  -Headers @{ 'x-user-id' = 'user-1'; 'Idempotency-Key' = [guid]::NewGuid().ToString() } `
  -Body '{"gameId":"1","roundId":"1002","oddId":"roulette-red","betAmount":10}'
```

bash:

```bash
URL='http://localhost:4566/_aws/execute-api/<apiId>/$default/bets'

curl -i -X POST "$URL" \
  -H 'content-type: application/json' \
  -H 'x-user-id: user-1' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"gameId":"1","roundId":"1002","oddId":"roulette-red","betAmount":10}'
```

From Postman, set the `Idempotency-Key` header to `{{$guid}}` so that every request gets a new key. With a fixed key the first request returns `201` and every repeat returns `409`.

Things to try:

| To see                     | Change                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| A duplicate rejected       | Send the same request twice with the same `Idempotency-Key`                   |
| The betting window closing | Create a round with `POST /rounds`, bet on it, and bet again after 30 seconds |
| Insufficient funds         | Use a `betAmount` above 1000                                                  |
| A round of another game    | `gameId` `1` with `roundId` `2001`                                            |

### Inspecting the data

[dynamodb-admin](https://github.com/aaronshaf/dynamodb-admin) is a web interface for browsing DynamoDB tables. It is installed as a development dependency and preconfigured for MiniStack:

```
npm run db:admin
```

It opens `http://localhost:8001`, where the five tables can be browsed, filtered and edited. It needs MiniStack running, and reads its address from `DYNAMO_ENDPOINT` in `.env`. It keeps the terminal busy until stopped with `Ctrl+C`.

### Scripts

| Command                                     | What it does                                                      |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `npm run local:setup`                       | Everything needed to go from nothing to a working local API       |
| `npm run local:up` / `local:down`           | Start / stop the MiniStack container                              |
| `npm run db:create`                         | Create the tables that do not exist yet                           |
| `npm run db:seed`                           | Load or refresh the seed data                                     |
| `npm run db:admin`                          | Open dynamodb-admin                                               |
| `npm run deploy`                            | Bundle and deploy both functions and their routes. Safe to repeat |
| `npm test`                                  | Unit tests                                                        |
| `npm run load-test`                         | Load test against the deployed API                                |
| `npm run typecheck`, `lint`, `format:check` | Static checks                                                     |

### Ports

| Port   | Service                                             |
| ------ | --------------------------------------------------- |
| `4566` | MiniStack (all AWS services)                        |
| `8001` | dynamodb-admin, while `npm run db:admin` is running |

### Stop

```
npm run local:down
```

## Testing

### Unit tests

```
npm test
```

114 tests in 13 files, running in about two seconds with no Docker or MiniStack. They use in-memory doubles for DynamoDB and the wallet, and a controllable clock, which is what lets the betting window be tested to the millisecond.

They cover the betting window rule, both services, request validation, the mapping of every error to its HTTP status, the cache, the shard calculation and configuration loading. They also pin down the rules that protect money: the wallet is never debited when validation fails, a bet is never stored when the wallet refuses, and a duplicate never overwrites the original bet.

The three repositories that talk to DynamoDB are not covered by automated tests. Their behaviour (conditional write, atomic counter, composite key) was verified by hand against MiniStack. Covering it properly would take integration tests that start MiniStack.

### Load test

```
npm run load-test
npm run load-test -- --rate 278 --duration 20 --connections 40
```

Sends bets at a constant rate against round `1002`, each with a random user and a new idempotency key, after a short warm-up. When it finishes it counts the bets stored in DynamoDB for that run and checks that the number matches the `201` responses.

| Option                                    | Default                               | Meaning                                                      |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `--rate`                                  | `80`                                  | Bets per second                                              |
| `--duration`                              | `30`                                  | Seconds of load                                              |
| `--warmup`                                | `5`                                   | Seconds of warm-up at a quarter of the rate. `0` disables it |
| `--connections`                           | `20`                                  | Concurrent connections                                       |
| `--users`                                 | `1000`                                | Distinct users the bets are spread across                    |
| `--game`, `--round`, `--odds`, `--amount` | `1`, `1002`, five roulette odds, `10` | What is bet on                                               |
| `--url`                                   | The locally deployed API              | Target, for running it against real AWS                      |

Results on a laptop with MiniStack in Docker:

|                        | Default rate   | Target rate       |
| ---------------------- | -------------- | ----------------- |
| Requested              | 80 bets/s      | 278 bets/s        |
| Achieved               | 77 bets/s      | 105 bets/s        |
| Bets accepted / stored | 2,500 / 2,500  | 5,905 / 5,905     |
| Errors                 | 0              | 0                 |
| Latency p50 / p99      | 86 ms / 375 ms | 191 ms / 1,715 ms |

Read these numbers for what they are. MiniStack is a single process on one machine and tops out near 100 requests per second whatever the concurrency, so the local test cannot reach the target rate. What it does show is that the code is correct under concurrency: no bet was lost or stored twice. It says nothing about how the system scales. That can only be measured on AWS, by pointing the same script at a real deployment with `--url`.

## Project layout

```
src/
  handlers/       Lambda entry points, request validation, HTTP responses
  services/       Business flow of placing a bet and creating a round
  repositories/   DynamoDB access, reference data cache, shard calculation
  clients/        DynamoDB client factory and the wallet client
  domain/         Types, business rules and business errors
  config/         Environment variables
  logging/        Structured JSON logs
scripts/          Table creation, seed, deployment and load test
tests/            Unit tests, mirroring src/
```

Handlers know about HTTP and nothing about DynamoDB; services know about neither. Services receive their dependencies through the constructor, which is what makes them testable without AWS.

## Design decisions

- **Bets are partitioned by user, not by round.** Partitioning `Bets` by `roundId` would be the natural choice for settlement, but it would send every write of a popular round to one partition, which caps at roughly 1,000 writes per second. Partitioning by `userId` spreads writes across all partitions regardless of how many players pick the same round.

- **A sharded index makes settlement possible without scanning.** Settling a round means finding every bet placed on the winning odds, and with bets partitioned by user that would require reading the whole table. The `RoundOdds` index solves it, but a plain index on `roundId` would recreate the hot partition, and a throttled index also throttles writes to the table itself. So each bet is assigned to one of 10 shards, computed from a hash of its `betId`, and the index key is `gameId#roundId#shard`, for example `1#1002#5`. Writes for one round are spread over 10 index partitions. To settle, the 10 shards are queried in parallel for each winning odd (`roundShard = "1#1002#0" AND oddId = "roulette-red"`, and so on) and the results merged. Only winning bets are read. The cost is two writes per bet instead of one, and 10 queries per winning odd at settlement. The shard count is configurable through `ROUND_SHARD_COUNT`. Settlement itself is not implemented; the index is in place because it has to be decided when bets are written.

- **Duplicates are rejected by the write, not looked up first.** The bet is written with the condition that no item with that `userId` and `betId` exists. DynamoDB evaluates the condition atomically, so of several simultaneous identical requests exactly one succeeds and the rest get `409 DUPLICATE_BET`, with no locks and no coordination between Lambda instances. The key is scoped to the user: the same key from two users is two bets.

- **The wallet must be idempotent on the bet id.** The wallet is debited before the bet is written, so a duplicate request reaches the wallet before it is rejected. Double charging is avoided only because the debit carries the `betId` as its own idempotency key and the wallet is assumed to honour it. This is an assumption about an external service, and the design depends on it. The same property covers the case where the debit succeeds and the write then fails: the client retries with the same key, the wallet does not charge again, and the write completes.

- **Rounds are cached until they end, and the window is decided by the clock.** Every bet on a round reads the same round item, and a single item cannot be spread across partitions, so at scale it would saturate long before the bet writes do. Because a round's dates never change once it exists, each Lambda instance reads a round once, keeps it in memory until its `endDate`, and decides whether betting is open by comparing the current time with the stored dates. Games and odds are cached for five minutes. Lookups that find nothing are not cached, so a newly created round is visible immediately.

- **The stored status is informational.** Whether a round accepts bets is derived from its dates, never from its `status` attribute. Nothing updates `status` as time passes, so a round created as `open` stays `open` in the table after its window closes.

- **Round ids are a sequence per game.** DynamoDB has no auto-increment, and finding the highest id would mean scanning the table, with two simultaneous requests reading the same maximum. Each game has an atomic counter in the `Counters` table that is incremented in a single operation, which yields the highest id plus one without scans or collisions. Since ids are only unique within a game, `Rounds` is keyed by `gameId` and `roundId` together. A consequence is that a round id belonging to another game is reported as `ROUND_NOT_FOUND`.

- **A retry after the window closes is rejected.** Validation runs before anything else, so a client that retries an already accepted bet once the window has closed receives `BETTING_WINDOW_CLOSED` instead of `DUPLICATE_BET`. This is accepted: players see their accepted bets in another part of the platform.

- **One Lambda function per endpoint.** Placing bets and creating rounds have very different traffic. Separate functions scale, fail and are limited independently.

- **No throttling is configured on the API.** The account default of 10,000 requests per second is far above the target rate.

## Assumptions and limitations

- **The wallet is simulated.** It keeps no balances: it accepts any debit up to 1000 and refuses anything above (`SIMULATED_WALLET_MAX_DEBIT`). It has no latency and never fails. A real implementation would be another class behind the same `WalletClient` interface, calling the wallet service over HTTP with a short timeout.
- **There is no authentication.** `x-user-id` is trusted as sent, and `POST /rounds` is open to anyone who knows the URL.
- **Settlement is out of scope.** Bets stay in status `ACCEPTED`.
- **`betAmount` has no currency or unit.** A production system would store amounts as integers in the smallest currency unit.
- **Deployment is a local script.** `scripts/deploy.ts` drives the AWS SDK directly and uses a placeholder IAM role that MiniStack accepts. A real deployment would use infrastructure as code and a role limited to the five tables.
- **MiniStack does not model AWS limits.** API Gateway throttling and DynamoDB capacity limits are not simulated, so none of the scaling behaviour described above can be observed locally.

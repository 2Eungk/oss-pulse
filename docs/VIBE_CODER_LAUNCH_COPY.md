# Vibe coder launch copy

Use this when sharing `oss-pulse` with builders who ship fast, then clean up the repo before showing it to strangers.

## Core angle

You vibe-coded the tool. `oss-pulse` checks whether the repo is ready for other people to touch.

It does not judge the code. It checks the public maintainer layer: license, contribution guide, issue templates, security policy, CI, changelog, release workflow, and next actions.

## X / Twitter

```txt
I built oss-pulse for the moment after a vibe-coded project works locally and before you post the GitHub link.

It checks whether the repo is ready for outside contributors:
README, license, contributing guide, issue templates, security policy, CI, changelog, release workflow, and next actions.

npx --yes oss-pulse@0.1.4 scan . --format launch-post

https://github.com/2Eungk/oss-pulse
```

## X / Twitter, shorter

```txt
Vibe-coded a repo and about to post it?

Run this first:

npx --yes oss-pulse@0.1.4 scan . --format launch-post

oss-pulse checks the boring OSS surfaces people expect before opening a PR: license, contributing guide, issue templates, security policy, CI, changelog, and release workflow.

https://github.com/2Eungk/oss-pulse
```

## GeekNews / Korean developer communities

Title:

```txt
oss-pulse: 바이브코딩한 저장소를 공개하기 전에 OSS 준비 상태를 점검하는 CLI
```

Body:

```txt
바이브코딩으로 작은 툴을 만들고 npm/GitHub에 올리다 보면, 코드보다 더 귀찮은 게 남습니다.

LICENSE 넣었나? CONTRIBUTING 있나? 이슈 템플릿은? SECURITY.md는? CI는? changelog랑 release workflow는?

`oss-pulse`는 그 공개 전 체크를 한 번에 보는 작은 CLI입니다.

npx --yes oss-pulse@0.1.4 scan . --format launch-post

보안 스캐너나 코드 품질 툴은 아니고, 외부 기여자가 들어오기 전에 필요한 maintainer surface를 점검합니다. GitHub Action, JSON, SARIF, GitHub annotations 출력도 지원합니다.

피드백 받고 싶습니다. 실제 maintainer 입장에서 빠진 체크가 있으면 이슈로 남겨주세요.

https://github.com/2Eungk/oss-pulse
```

## Reddit / HN

```txt
I made a small CLI for the moment after a vibe-coded repo works locally and before you share the GitHub link.

It checks the maintainer layer people expect before they open a PR: license, contributing guide, issue templates, security policy, CI, changelog, release workflow, and ranked next actions.

It is intentionally not a code quality or security scanner. It is a preflight check for “does this repo look maintained enough for outside contributors?”

npx --yes oss-pulse@0.1.4 scan . --format launch-post

Feedback from maintainers would be useful: what checks would you add or remove?
```

## Screenshot command

```bash
npx --yes oss-pulse@0.1.4 scan . --format launch-post
```

Capture the output with the score and top action visible. Avoid a busy terminal theme. The screenshot should make the product understandable in five seconds.

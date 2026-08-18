#!/bin/bash
# 맥에서 더블클릭으로 실행하는 파일입니다.
# 처음 한 번은 마우스 오른쪽 클릭 → 열기 를 눌러야 할 수 있습니다.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  cat scripts/no-node.txt
  open https://nodejs.org/ko/download
  read -r -p "엔터를 누르면 닫힙니다..."
  exit 1
fi

node scripts/start.mjs
read -r -p "엔터를 누르면 닫힙니다..."

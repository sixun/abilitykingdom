신규 캐릭터(Character-Additions 패키지) 배경 제거 절차 — 원본 참고 이미지에 없는 픽셀은 만들지 않는다.
1) 모델: https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx → /tmp/claude-0/models/
   pip install onnxruntime
2) python3 1_segment.py   : 애니메 인물 분할 마스크(/tmp/claude-0/cut/*-mask.png)
3) 장검 캐릭터(JPG 체크무늬): checker2.fit2로 체크무늬 주기(x·y)·색을 맞춘 배경판을 만들어 chk-*.npy로 저장
   (2_cutout.py가 읽는다. 파일별 주기: ref-01 20.0, ref-02 21.06×20.98, ref-03 18.58×18.54)
4) python3 2_cutout.py    : 마스크 + 균일 배경 color-to-alpha(효과 보존) + 배경색 빼기 → /tmp/claude-0/cut/out/*.png
   - 키요미: 몸 밖은 배경보다 밝은 쪽(푸른 불꽃)만 살린다
   - 장검: 머리카락 사이 체크무늬 칸(예상 배경색과 거의 같은 밝은 무채색) 제거, 300px 미만 조각 제거
5) python3 tools/build_new_characters.py (저장소 루트에서) : 게임 에셋으로 자르기·크기 조정

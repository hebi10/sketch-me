import {
  EMPTY_FACE_SELECTION,
  FACE_PARTS,
  hasFaceSelection,
  randomFaceSelection,
  selectFacePart,
  selectedFacePartSources,
} from '@/components/sketch/face-parts';

describe('얼굴 파츠 모델', () => {
  it('얼굴형, 머리, 눈, 입, 소품 순서로 선택 자산을 반환한다', () => {
    const selection = {
      face: FACE_PARTS.face[0].id,
      hair: FACE_PARTS.hair[0].id,
      eyes: FACE_PARTS.eyes[0].id,
      mouth: FACE_PARTS.mouth[0].id,
      accessory: FACE_PARTS.accessory[0].id,
    };

    expect(selectedFacePartSources(selection)).toEqual([
      FACE_PARTS.face[0].src,
      FACE_PARTS.hair[0].src,
      FACE_PARTS.eyes[0].src,
      FACE_PARTS.mouth[0].src,
      FACE_PARTS.accessory[0].src,
    ]);
  });

  it('비어 있는 선택과 단일 선택을 구분한다', () => {
    expect(hasFaceSelection(EMPTY_FACE_SELECTION)).toBe(false);
    expect(hasFaceSelection(selectFacePart(EMPTY_FACE_SELECTION, 'eyes', FACE_PARTS.eyes[0].id))).toBe(true);
  });

  it('존재하지 않는 파츠는 선택하지 않는다', () => {
    expect(selectFacePart(EMPTY_FACE_SELECTION, 'eyes', 'missing')).toEqual(EMPTY_FACE_SELECTION);
  });

  it('주입한 난수로 모든 카테고리를 재현 가능하게 조합한다', () => {
    expect(randomFaceSelection(() => 0)).toEqual({
      face: FACE_PARTS.face[0].id,
      hair: FACE_PARTS.hair[0].id,
      eyes: FACE_PARTS.eyes[0].id,
      mouth: FACE_PARTS.mouth[0].id,
      accessory: FACE_PARTS.accessory[0].id,
    });
  });
});

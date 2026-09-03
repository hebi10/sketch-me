import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const {
  createManagePinSession,
  enforceAppCheck,
  enforcePublicMutationLimit,
  fileDelete,
  fileSave,
  findSketchbookByPublicId,
  getAdminStorage,
  getDrawingSubmissionSourceHash,
  getPublicMutationHeaders,
  optimizeDrawingImages,
  optimizeImageForStorage,
  push,
  saveDrawingWithinLimit,
  saveSketchbook,
  storageFile,
} = vi.hoisted(() => ({
  createManagePinSession: vi.fn(),
  enforceAppCheck: vi.fn(),
  enforcePublicMutationLimit: vi.fn(),
  fileDelete: vi.fn(),
  fileSave: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getAdminStorage: vi.fn(),
  getDrawingSubmissionSourceHash: vi.fn(),
  getPublicMutationHeaders: vi.fn(),
  optimizeDrawingImages: vi.fn(),
  optimizeImageForStorage: vi.fn(),
  push: vi.fn(),
  saveDrawingWithinLimit: vi.fn(),
  saveSketchbook: vi.fn(),
  storageFile: vi.fn(),
}));

vi.mock('@/lib/security/app-check-server', () => ({ enforceAppCheck }));
vi.mock('@/lib/security/app-check-client', () => ({ getPublicMutationHeaders }));
vi.mock('@/lib/security/rate-limit', () => ({ enforcePublicMutationLimit }));
vi.mock('@/lib/security/drawing-submission-source', () => ({ getDrawingSubmissionSourceHash }));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/images/optimize', () => ({
  ImageOptimizationError: class ImageOptimizationError extends Error {},
  optimizeDrawingImages,
  optimizeImageForStorage,
}));
vi.mock('@/lib/sketchbooks/repository', () => ({
  createManagePinSession,
  findSketchbookByPublicId,
  saveDrawingWithinLimit,
  saveSketchbook,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push }),
}));
vi.mock('@/components/sketch/SketchEditor', async () => {
  const ReactModule = await import('react');
  return {
    SketchEditor: ReactModule.forwardRef(function SketchEditorMock(_props, ref) {
      ReactModule.useImperativeHandle(ref, () => ({
        clearDrawing: vi.fn(),
        exportDrawing: () => 'data:image/png;base64,aW1hZ2U=',
        hasDrawing: () => true,
        undo: vi.fn(),
      }));
      return ReactModule.createElement('div', { 'aria-label': '그림 편집기' });
    }),
  };
});

import { POST as createSketchbook } from '@/app/api/sketchbooks/route';
import { POST as submitDrawing } from '@/app/api/sketchbooks/[publicId]/drawings/route';
import { CreateSketchbookForm } from '@/app/create/CreateSketchbookForm';
import { SketchCanvas } from '@/app/s/[publicId]/draw/SketchCanvas';

const appCheckRejection = new Response(
  JSON.stringify({ message: '보안 확인에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.' }),
  { headers: { 'Content-Type': 'application/json' }, status: 401 },
);

describe('공개 mutation Route Handler App Check 순서', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceAppCheck.mockResolvedValue(appCheckRejection);
    enforcePublicMutationLimit.mockReturnValue(null);
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({
        file: storageFile,
      })),
    });
    storageFile.mockReturnValue({ delete: fileDelete, save: fileSave });
    createManagePinSession.mockResolvedValue({ sessionId: 'session-1', token: 'session-token' });
    findSketchbookByPublicId.mockResolvedValue({
      id: 'book-1',
      manageTokenHash: 'book-secret',
      moderationStatus: 'ACTIVE',
      name: '해비',
      participantCount: 0,
      participantLimit: 20,
      publicId: 'public-1',
      status: 'PUBLIC',
    });
    optimizeImageForStorage.mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });
    optimizeDrawingImages.mockResolvedValue({
      original: { buffer: Buffer.from('original-webp'), contentType: 'image/webp' },
      thumbnail: { buffer: Buffer.from('thumbnail-webp'), contentType: 'image/webp' },
    });
    getDrawingSubmissionSourceHash.mockReturnValue('source-hash');
  });

  it('스케치북 생성은 App Check 거절 시 다른 제한·저장 동작 전에 중단한다', async () => {
    const request = new Request('http://localhost/api/sketchbooks', {
      body: JSON.stringify({ managePin: '1234', name: '해비' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await createSketchbook(request);

    expect(response.status).toBe(401);
    expect(enforceAppCheck).toHaveBeenCalledOnce();
    expect(enforceAppCheck).toHaveBeenCalledWith(request);
    expect(enforcePublicMutationLimit).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(saveSketchbook).not.toHaveBeenCalled();
  });

  it('그림 제출은 App Check 거절 시 조회·이미지 처리·저장 전에 중단한다', async () => {
    const request = new Request('http://localhost/api/sketchbooks/public-1/drawings', {
      body: JSON.stringify({
        authorName: '친구',
        imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await submitDrawing(request, { params: Promise.resolve({ publicId: 'public-1' }) });

    expect(response.status).toBe(401);
    expect(enforceAppCheck).toHaveBeenCalledOnce();
    expect(enforceAppCheck).toHaveBeenCalledWith(request);
    expect(enforcePublicMutationLimit).not.toHaveBeenCalled();
    expect(findSketchbookByPublicId).not.toHaveBeenCalled();
    expect(optimizeImageForStorage).not.toHaveBeenCalled();
    expect(saveDrawingWithinLimit).not.toHaveBeenCalled();
  });
});

describe('친구 그림 원본·썸네일 동시 저장', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceAppCheck.mockResolvedValue(null);
    enforcePublicMutationLimit.mockReturnValue(null);
    findSketchbookByPublicId.mockResolvedValue({
      id: 'book-1',
      manageTokenHash: 'book-secret',
      moderationStatus: 'ACTIVE',
      name: '해비',
      participantCount: 0,
      participantLimit: 20,
      publicId: 'public-1',
      status: 'PUBLIC',
    });
    optimizeDrawingImages.mockResolvedValue({
      original: { buffer: Buffer.from('original-webp'), contentType: 'image/webp' },
      thumbnail: { buffer: Buffer.from('thumbnail-webp'), contentType: 'image/webp' },
    });
    getDrawingSubmissionSourceHash.mockReturnValue('source-hash');
    storageFile.mockReturnValue({ delete: fileDelete, save: fileSave });
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({ file: storageFile })),
    });
  });

  function drawingRequest() {
    return new Request('http://localhost/api/sketchbooks/public-1/drawings', {
      body: JSON.stringify({
        authorName: '친구',
        imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  }

  it('한 번의 제출로 원본과 결정적 썸네일 경로를 모두 저장한다', async () => {
    const response = await submitDrawing(drawingRequest(), {
      params: Promise.resolve({ publicId: 'public-1' }),
    });

    expect(response.status).toBe(201);
    expect(optimizeDrawingImages).toHaveBeenCalledOnce();
    expect(storageFile.mock.calls.map(([path]) => path)).toEqual([
      expect.stringMatching(/^sketchbooks\/book-1\/drawings\/.+\/original\.webp$/),
      expect.stringMatching(/^sketchbooks\/book-1\/drawings\/.+\/thumbnail\.webp$/),
    ]);
    expect(fileSave).toHaveBeenCalledTimes(2);
    expect(saveDrawingWithinLimit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'book-1' }),
      expect.objectContaining({
        imagePath: expect.stringMatching(/\/original\.webp$/),
        thumbnailPath: expect.stringMatching(/\/thumbnail\.webp$/),
      }),
      'source-hash',
    );
  });

  it('같은 스케치북의 IP 제출 한도를 넘으면 안내하고 업로드 파일을 정리한다', async () => {
    saveDrawingWithinLimit.mockRejectedValueOnce(new Error('한 친구는 같은 스캐치북에 그림을 2개까지만 남길 수 있어요.'));

    const response = await submitDrawing(drawingRequest(), {
      params: Promise.resolve({ publicId: 'public-1' }),
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      message: '한 친구는 같은 스캐치북에 그림을 2개까지만 남길 수 있어요.',
    });
    expect(fileDelete).toHaveBeenCalledTimes(2);
  });

  it('Firestore 등록이 실패하면 생성한 원본과 썸네일을 모두 정리한다', async () => {
    saveDrawingWithinLimit.mockRejectedValueOnce(new Error('친구 그림을 더 받을 수 있는 인원이 모두 찼습니다.'));

    const response = await submitDrawing(drawingRequest(), {
      params: Promise.resolve({ publicId: 'public-1' }),
    });

    expect(response.status).toBe(409);
    expect(fileDelete).toHaveBeenCalledTimes(2);
    expect(fileDelete).toHaveBeenNthCalledWith(1, { ignoreNotFound: true });
    expect(fileDelete).toHaveBeenNthCalledWith(2, { ignoreNotFound: true });
  });

  it('예상하지 못한 저장 오류의 원문을 응답에 노출하지 않는다', async () => {
    saveDrawingWithinLimit.mockRejectedValueOnce(new Error('firestore credential details'));

    const response = await submitDrawing(drawingRequest(), {
      params: Promise.resolve({ publicId: 'public-1' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: '그림을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
    expect(fileDelete).toHaveBeenCalledTimes(2);
  });

  it('예상하지 못한 이미지 처리 오류의 원문을 응답에 노출하지 않는다', async () => {
    optimizeDrawingImages.mockRejectedValueOnce(new Error('sharp internal path'));

    const response = await submitDrawing(drawingRequest(), {
      params: Promise.resolve({ publicId: 'public-1' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: '그림을 변환하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  });
});

describe('공개 mutation 클라이언트 App Check 헤더', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getPublicMutationHeaders.mockResolvedValue({ 'X-Firebase-AppCheck': 'client-token' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ drawingId: 'drawing-1', manageUrl: '/m/public-1', publicUrl: '/s/public-1' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('스케치북 생성 요청에 발급된 App Check 헤더를 한 번 포함한다', async () => {
    render(React.createElement(CreateSketchbookForm));
    fireEvent.change(screen.getByLabelText('이름 또는 애칭'), { target: { value: '해비' } });
    fireEvent.change(screen.getByLabelText('관리용 비밀번호'), { target: { value: '1234' } });

    fireEvent.click(screen.getByRole('button', { name: '내 스캐치북 만들기' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(getPublicMutationHeaders).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/sketchbooks', expect.objectContaining({
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': 'client-token',
      },
      method: 'POST',
    }));
  });

  it('그림 제출 요청에 발급된 App Check 헤더를 한 번 포함한다', async () => {
    render(React.createElement(SketchCanvas, {
      publicId: 'public-1',
      sketchbookName: '해비',
    }));
    fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: '친구' } });

    fireEvent.click(screen.getByRole('button', { name: '그림 남기기' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(getPublicMutationHeaders).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/sketchbooks/public-1/drawings', expect.objectContaining({
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': 'client-token',
      },
      method: 'POST',
    }));
  });
});

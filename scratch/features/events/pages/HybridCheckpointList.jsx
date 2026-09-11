import React from 'react';
import { Card, Button, Input, Row, Col, Typography, InputNumber, message, Upload as AntUpload } from 'antd';
import { EnvironmentOutlined, DeleteOutlined, UploadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useUploadImageMutation } from '../../../app/uploadApi';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Text } = Typography;

const TYPE_LABELS = {
    'GPS': '📍 GPS',
    'QR': '📱 QR',
    'CODE': '🔒 Secret Code',
    'QA': '❓ Q&A',
    'PHOTO': '📸 Photo'
};

function CheckpointCard({ checkpoint, index, totalCount, updateCheckpoint, removeCheckpoint, moveCheckpoint, onMapSelect, uploadImage }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: checkpoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const renderFields = () => {
    switch (checkpoint.type) {
      case 'GPS':
        return (
          <Row gutter={12}>
             <Col span={10}>
                <InputNumber value={checkpoint.latitude} onChange={v => updateCheckpoint(checkpoint.id, 'latitude', v)} placeholder="Lat" className="w-full" precision={6} />
             </Col>
             <Col span={10}>
                <InputNumber value={checkpoint.longitude} onChange={v => updateCheckpoint(checkpoint.id, 'longitude', v)} placeholder="Lng" className="w-full" precision={6} />
             </Col>
             <Col span={4}>
                <Button icon={<EnvironmentOutlined />} onClick={() => onMapSelect(checkpoint.id)} type="primary" ghost className="w-full" />
             </Col>
             <Col span={24} className="mt-2">
                <Input value={checkpoint.description} onChange={e => updateCheckpoint(checkpoint.id, 'description', e.target.value)} placeholder="Description (e.g. Center of town square)" />
             </Col>
          </Row>
        );
      case 'QR':
        return (
          <Input value={checkpoint.description} onChange={e => updateCheckpoint(checkpoint.id, 'description', e.target.value)} placeholder="QR Location Description (e.g. Find the poster on our front door)" />
        );
      case 'CODE':
        return (
          <Row gutter={12}>
             <Col span={12}>
                 <Input value={checkpoint.secretCode} onChange={e => updateCheckpoint(checkpoint.id, 'secretCode', e.target.value)} placeholder="Secret Code (e.g. WINNER)" maxLength={8} />
             </Col>
             <Col span={12}>
                 <Input value={checkpoint.description} onChange={e => updateCheckpoint(checkpoint.id, 'description', e.target.value)} placeholder="Hint for the user" />
             </Col>
          </Row>
        );
      case 'QA':
        return (
          <Row gutter={12}>
             <Col span={24} className="mb-2">
                 <Input value={checkpoint.description} onChange={e => updateCheckpoint(checkpoint.id, 'description', e.target.value)} placeholder="Description / Location of question" />
             </Col>
             <Col span={12}>
                 <Input value={checkpoint.question} onChange={e => updateCheckpoint(checkpoint.id, 'question', e.target.value)} placeholder="Question" />
             </Col>
             <Col span={12}>
                 <Input value={checkpoint.answer} onChange={e => updateCheckpoint(checkpoint.id, 'answer', e.target.value)} placeholder="Exact Answer" />
             </Col>
          </Row>
        );
      case 'PHOTO':
        return (
          <Row gutter={12}>
             <Col span={12}>
                 <Input value={checkpoint.description} onChange={e => updateCheckpoint(checkpoint.id, 'description', e.target.value)} placeholder="Where to take the photo" className="mb-2" />
             </Col>
             <Col span={12}>
                 <Input value={checkpoint.photoRequirements} onChange={e => updateCheckpoint(checkpoint.id, 'photoRequirements', e.target.value)} placeholder="Photo Requirements (e.g. Must include face)" className="mb-2" />
             </Col>
             <Col span={24}>
                 <AntUpload 
                     listType="picture" 
                     maxCount={1} 
                     accept="image/*"
                     customRequest={async ({ file, onSuccess, onError }) => {
                         const formData = new FormData();
                         formData.append('image', file);
                         try {
                             const uploadResponse = await uploadImage({ folder: 'eventReward', formData }).unwrap();
                             if (uploadResponse && uploadResponse.url) {
                                 onSuccess(uploadResponse, file);
                                 updateCheckpoint(checkpoint.id, 'referencePhotoUrl', uploadResponse.url);
                                 message.success('Reference photo uploaded successfully');
                             } else {
                                 throw new Error('Upload failed');
                             }
                         } catch (error) {
                             onError(error);
                             message.error('Failed to upload reference photo');
                         }
                     }}
                     defaultFileList={checkpoint.referencePhotoUrl ? [{ uid: '-1', name: 'Reference Photo', status: 'done', url: checkpoint.referencePhotoUrl }] : []}
                 >
                     <Button icon={<UploadOutlined />}>Upload Reference Photo (Optional)</Button>
                 </AntUpload>
             </Col>
          </Row>
        );
      default:
        return null;
    }
  }

  return (
    <Card ref={setNodeRef} style={style} size="small" className={`border ${checkpoint.type === 'PHOTO' ? 'border-purple-300 bg-purple-50' : 'border-gray-200'} shadow-sm mb-3 relative overflow-hidden`}>
      <div className="flex gap-4">
          <div 
              {...attributes}
              {...listeners}
              title="Drag to reorder"
              className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex-shrink-0 mt-1 shadow-sm cursor-grab active:cursor-grabbing touch-none"
          >
              {index + 1}
          </div>

          <div className="flex-grow">
              <div className="flex justify-between items-center mb-2">
                  <Text strong className={checkpoint.type === 'PHOTO' ? 'text-purple-700' : 'text-gray-700'}>
                      {TYPE_LABELS[checkpoint.type]} Checkpoint
                  </Text>
                  <div>
                      <Button type="text" icon={<ArrowUpOutlined />} onClick={() => moveCheckpoint(index, -1)} disabled={index === 0} size="small" />
                      <Button type="text" icon={<ArrowDownOutlined />} onClick={() => moveCheckpoint(index, 1)} disabled={index === totalCount - 1} size="small" />
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeCheckpoint(checkpoint.id)} size="small" className="ml-2" />
                  </div>
              </div>
              {renderFields()}
          </div>
      </div>
    </Card>
  );
}

export default function HybridCheckpointList({ checkpoints, setCheckpoints, onMapSelect }) {
  const [uploadImage] = useUploadImageMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active && over && active.id !== over.id) {
      const oldIndex = checkpoints.findIndex(cp => cp.id === active.id);
      const newIndex = checkpoints.findIndex(cp => cp.id === over.id);
      setCheckpoints(arrayMove(checkpoints, oldIndex, newIndex));
    }
  };

  const addCheckpoint = (type) => {
    const newId = Math.random().toString(36).substring(7);
    const newCp = { id: newId, type };
    setCheckpoints(prev => [...prev, newCp]);
  };

  const removeCheckpoint = (id) => {
    setCheckpoints(checkpoints.filter(cp => cp.id !== id));
  };

  const updateCheckpoint = (id, field, value) => {
    setCheckpoints(checkpoints.map(cp => 
        cp.id === id ? { ...cp, [field]: value } : cp
    ));
  };

  const moveCheckpoint = (index, direction) => {
    const newCheckpoints = [...checkpoints];
    if (index + direction < 0 || index + direction >= newCheckpoints.length) return;
    const temp = newCheckpoints[index];
    newCheckpoints[index] = newCheckpoints[index + direction];
    newCheckpoints[index + direction] = temp;
    setCheckpoints(newCheckpoints);
  };

  return (
    <div className="space-y-6">
        <div>
            <div className="flex gap-2 flex-wrap mb-4">
                <Button onClick={() => addCheckpoint('GPS')} type="dashed" className="border-blue-300 text-blue-600 bg-blue-50">+ 📍 GPS</Button>
                <Button onClick={() => addCheckpoint('QR')} type="dashed" className="border-green-300 text-green-600 bg-green-50">+ 📱 QR</Button>
                <Button onClick={() => addCheckpoint('CODE')} type="dashed" className="border-orange-300 text-orange-600 bg-orange-50">+ 🔒 Code</Button>
                <Button onClick={() => addCheckpoint('QA')} type="dashed" className="border-cyan-300 text-cyan-600 bg-cyan-50">+ ❓ Q&A</Button>
            </div>

            {checkpoints.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-xl border-gray-200 bg-white">
                    Click a button above to add your first checkpoint!
                </div>
            ) : (
                <div className="mt-4">
                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={checkpoints.map(c => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {checkpoints.map((cp, idx) => (
                                <CheckpointCard 
                                    key={cp.id} 
                                    checkpoint={cp} 
                                    index={idx}
                                    totalCount={checkpoints.length}
                                    updateCheckpoint={updateCheckpoint}
                                    removeCheckpoint={removeCheckpoint}
                                    moveCheckpoint={moveCheckpoint}
                                    onMapSelect={onMapSelect}
                                    uploadImage={uploadImage}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            )}
        </div>
    </div>
  );
}

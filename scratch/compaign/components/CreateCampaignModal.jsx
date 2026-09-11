import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Select, Switch, Button, message, AutoComplete, Upload, Slider } from 'antd';
import { EnvironmentOutlined, UploadOutlined } from '@ant-design/icons';
import { compaignApi } from '../api/compaign';
import { useUploadImageMutation } from '../../../app/uploadApi';
import { useDispatch } from 'react-redux';
const { Option } = Select;
const { TextArea } = Input;

export default function CreateCampaignModal({ visible, onClose, onSuccess, editData }) {
  const dispatch = useDispatch();
  const [uploadImage] = useUploadImageMutation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [locationData, setLocationData] = useState(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const autocompleteService = useRef(null);
  const mapRef = useRef(null);
  const googleMap = useRef(null);
  const marker = useRef(null);

  // Watch fields for conditional rendering
  // Watch fields for conditional rendering
  const adCategory = Form.useWatch('adCategory', form);

  // Normalize file uploads for Ant Design Form
  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (visible && editData) {
      form.setFieldsValue({
        campaignName: editData.adTitle,
        adCategory: editData.adCategory?.toLowerCase() === 'geo campaign' ? 'Geo Campaign' : 'Single Store Campaign',
        shortDescription: editData.descriptionText || editData.mysteryBoxText,
        mysteryBoxReward: editData.mysteryBoxReward || '',
        stockLimit: editData.stockLimit || 50,
        category: editData.placeCategory ? editData.placeCategory.charAt(0).toUpperCase() + editData.placeCategory.slice(1) : 'Culinary',
        address: editData.address,
        radius: editData.radius || 5,
        active: editData.isActive !== false,
        image: editData.imageUrl ? [{ uid: '-1', name: 'campaign-image.jpg', status: 'done', url: editData.imageUrl }] : undefined,
      });
      setLocationData({
        city: editData.city,
        country: editData.country,
        latitude: editData.latitude,
        longitude: editData.longitude,
      });
    } else if (visible && !editData) {
      form.resetFields();
      setLocationData(null);
    }
  }, [visible, editData, form]);

  const handleSearch = (value) => {
    if (!value) {
      setOptions([]);
      return;
    }

    if (!autocompleteService.current && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
    if (autocompleteService.current) {
      autocompleteService.current.getPlacePredictions({ input: value }, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setOptions(predictions.map((p) => ({ value: p.description, place_id: p.place_id })));
        } else {
          setOptions([]);
        }
      });
    }
  };

  const handleSelect = (value, option) => {
    if (!window.google) return;
    const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
    placesService.getDetails({ placeId: option.place_id, fields: ['geometry', 'address_components'] }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        let city = "Unknown";
        let country = "Unknown";

        if (place.address_components) {
          place.address_components.forEach(component => {
            if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
              city = component.long_name;
            }
            if (component.types.includes('country')) {
              country = component.long_name;
            }
          });
        }

        let latitude = 0;
        let longitude = 0;
        if (place.geometry && place.geometry.location) {
          latitude = place.geometry.location.lat();
          longitude = place.geometry.location.lng();
        }

        setLocationData({ city, country, latitude, longitude });
      }
    });
  };

  useEffect(() => {
    if (isMapModalVisible && window.google) {
      setTimeout(() => {
        if (!mapRef.current) return;
        const defaultLocation = { lat: 25.2048, lng: 55.2708 }; // Default Dubai
        let initialLocation = locationData?.latitude
          ? { lat: locationData.latitude, lng: locationData.longitude }
          : defaultLocation;

        googleMap.current = new window.google.maps.Map(mapRef.current, {
          center: initialLocation,
          zoom: 13,
        });

        marker.current = new window.google.maps.Marker({
          position: initialLocation,
          map: googleMap.current,
          draggable: true,
        });

        window.google.maps.event.addListener(googleMap.current, 'click', (event) => {
          marker.current.setPosition(event.latLng);
        });

        if (!locationData?.latitude && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              if (googleMap.current && marker.current) {
                googleMap.current.setCenter(pos);
                marker.current.setPosition(pos);
              }
            },
            () => {
              // Geolocation failed or denied, default to Dubai
            }
          );
        }
      }, 150);
    }
  }, [isMapModalVisible, locationData]);

  const handleConfirmMapLocation = () => {
    if (marker.current && window.google) {
      const position = marker.current.getPosition();
      const lat = position.lat();
      const lng = position.lng();

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          const address = results[0].formatted_address;
          let city = "Unknown";
          let country = "Unknown";

          results[0].address_components.forEach(component => {
            if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
              city = component.long_name;
            }
            if (component.types.includes('country')) {
              country = component.long_name;
            }
          });

          form.setFieldsValue({ address });
          setLocationData({ city, country, latitude: lat, longitude: lng });
          setIsMapModalVisible(false);
        } else {
          message.error("Could not determine address for this location.");
        }
      });
    }
  };

  const handleCreate = async (values) => {
    setLoading(true);
    try {
      let merchantName = "Unknown Merchant";
      let merchantLogo = "";
      try {
        const storedUser = localStorage.getItem('merchantUser');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          if (userObj && userObj.businessName) {
            merchantName = userObj.businessName;
          }
          if (userObj && userObj.profilePicUrl) {
            merchantLogo = userObj.profilePicUrl;
          }
        }
      } catch (e) {
        console.error("Error parsing local storage merchant data", e);
      }

      // For MVP, mock image URLs. In production, upload e.logo[0].originFileObj to Firebase Storage
      const mockLogoUrl = merchantLogo || editData?.logoUrl || "https://ui-avatars.com/api/?name=Logo";
      let uploadedImageUrl = editData?.imageUrl || editData?.adImage || "";

      if (values.image && values.image.length > 0) {
        if (values.image[0].url) {
          // Uploaded directly via customRequest or already exists
          uploadedImageUrl = values.image[0].url;
        } else if (values.image[0].response && values.image[0].response.url) {
          uploadedImageUrl = values.image[0].response.url;
        }
      }

      if (!uploadedImageUrl) {
        uploadedImageUrl = "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=500&h=500&fit=crop";
      }

      const campaignPayload = {
        adTitle: values.campaignName,
        adCategory: values.adCategory || 'Single Store Campaign',
        categoryName: values.category,
        address: values.address,
        city: locationData?.city || "Unknown",
        country: locationData?.country || "Unknown",
        descriptionText: values.shortDescription || "",
        isActive: values.active !== false,
        latitude: locationData?.latitude || 0,
        longitude: locationData?.longitude || 0,
        radius: values.adCategory === 'Geo Campaign' ? values.radius : 0,
        mysteryBoxReward: values.mysteryBoxReward,
        stockLimit: parseInt(values.stockLimit, 10) || 50,
        adImage: uploadedImageUrl || "",
        logoUrl: mockLogoUrl,
      };

      if (editData) {
        await dispatch(compaignApi.endpoints.updateCampaign.initiate({ id: editData.id, ...campaignPayload })).unwrap();
        message.success('Campaign updated successfully!');
      } else {
        await dispatch(compaignApi.endpoints.createCampaign.initiate(campaignPayload)).unwrap();
        message.success('Campaign created successfully!');
      }

      form.resetFields();
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
      message.error("Failed to create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        title={<span className="text-xl font-bold text-[#111827]">{editData ? 'Edit Campaign' : 'Create New Ad'}</span>}
        open={visible}
        onCancel={onClose}
        footer={null}
        centered
        width={500}
        className="custom-campaign-modal"
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
            initialValues={{ adCategory: 'Single Store Campaign', category: 'Culinary', active: true, radius: 5, stockLimit: 50 }}
            className="mt-2"
          >
            <Form.Item
              name="campaignName"
              label="Campaign Name"
              rules={[{ required: true, message: 'Please enter the campaign name' }]}
            >
              <Input placeholder="E.g. Summer Kickoff" size="large" className="rounded-lg" />
            </Form.Item>

            <Form.Item
              name="adCategory"
              label="Ad Category"
              className="mt-4"
            >
              <Select size="large" className="rounded-lg" optionLabelProp="label" dropdownStyle={{ padding: '8px' }}>
                <Option value="Single Store Campaign" label="Single Store Campaign">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Single Store Campaign</span>
                    <span className="text-xs text-gray-500">Target an exact store location</span>
                  </div>
                </Option>
                <Option value="Geo Campaign" label="Geo Campaign">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Geo Campaign</span>
                    <span className="text-xs text-gray-500">Target a wider area or radius on the map</span>
                  </div>
                </Option>
              </Select>
            </Form.Item>

            <div className="mt-4">
              <Form.Item
                name="image"
                label="Campaign Image"
                valuePropName="fileList"
                getValueFromEvent={normFile}
                rules={[{ required: !editData, message: 'Please upload a campaign image' }]}
                extra={<span className="text-xs text-gray-500">Required dimensions: Exactly 1000 × 350 pixels</span>}
              >
                <Upload 
                  accept="image/*" 
                  maxCount={1} 
                  listType="picture"
                  beforeUpload={(file) => {
                    return new Promise((resolve, reject) => {
                      const img = new window.Image();
                      img.src = URL.createObjectURL(file);
                      img.onload = () => {
                        URL.revokeObjectURL(img.src);
                        if (img.width === 1000 && img.height === 350) {
                          resolve(true); // Allow upload to proceed to customRequest
                        } else {
                          message.error(`Image dimensions must be exactly 1000x350. You uploaded ${img.width}x${img.height}.`);
                          reject(Upload.LIST_IGNORE);
                        }
                      };
                      img.onerror = () => {
                        message.error('Failed to read image file.');
                        reject(Upload.LIST_IGNORE);
                      };
                    });
                  }}
                  customRequest={async ({ file, onSuccess, onError }) => {
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                      const uploadResponse = await uploadImage({ folder: 'compaigns', formData }).unwrap();
                      if (uploadResponse && uploadResponse.url) {
                        onSuccess(uploadResponse, file);
                        form.setFieldsValue({
                          image: [{
                            uid: file.uid,
                            name: file.name,
                            status: 'done',
                            url: uploadResponse.url,
                            response: uploadResponse
                          }]
                        });
                        message.success('Image uploaded instantly');
                      } else {
                        throw new Error('Upload failed: no URL returned');
                      }
                    } catch (error) {
                      console.error("Upload error", error);
                      onError(error);
                      message.error('Failed to upload image');
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />} className="w-full">Upload Image</Button>
                </Upload>
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Form.Item
                name="mysteryBoxReward"
                label="Mystery Box Reward"
                rules={[{ required: true, message: 'Please specify the reward' }]}
              >
                <Input placeholder="E.g. Free Drink, 1+1 Meal" size="large" className="rounded-lg" />
              </Form.Item>
              <Form.Item
                name="stockLimit"
                label="Stock Limit"
                rules={[
                  { required: true, message: 'Please specify the stock limit' },
                  () => ({
                    validator(_, value) {
                      if (!editData) return Promise.resolve();
                      const claimed = editData.rewardClaims || 0;
                      if (value && Number(value) < claimed) {
                        return Promise.reject(new Error(`Cannot be less than claimed (${claimed})`));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input type="number" placeholder="E.g. 50" size="large" className="rounded-lg" min={editData?.rewardClaims || 1} />
              </Form.Item>
            </div>

            <Form.Item
              name="shortDescription"
              label="Description"
              className="mt-4"
              rules={[{ max: 100, message: 'Description cannot exceed 100 characters' }]}
            >
              <TextArea
                placeholder="Text to show in mystery box..."
                autoSize={{ minRows: 3, maxRows: 5 }}
                className="rounded-lg"
                maxLength={100}
                showCount
              />
            </Form.Item>
            
            <div className="mt-8 mb-4">
              <h3 className="text-gray-800 text-base font-medium">Location</h3>
            </div>

            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: 'Please select a category' }]}
              extra={<span className="text-xs text-gray-500 mt-1 block">Matches mobile app place tags (nightlife, culture, etc.)</span>}
            >
              <Select size="large" className="rounded-lg w-full" optionLabelProp="label" dropdownStyle={{ padding: '8px' }}>
                <Option value="Nightlife" label="Nightlife">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Nightlife</span>
                    <span className="text-xs text-gray-500">Parties, clubs & venues for going out</span>
                  </div>
                </Option>
                <Option value="Culture" label="Culture">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Culture</span>
                    <span className="text-xs text-gray-500">Museums, galleries & cultural places</span>
                  </div>
                </Option>
                <Option value="Nature" label="Nature">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Nature</span>
                    <span className="text-xs text-gray-500">Parks, trails & natural spots</span>
                  </div>
                </Option>
                <Option value="Children" label="Children">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Children</span>
                    <span className="text-xs text-gray-500">Play areas, family parks & kid-friendly places</span>
                  </div>
                </Option>
                <Option value="Shopping" label="Shopping">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Shopping</span>
                    <span className="text-xs text-gray-500">Malls, markets & retail</span>
                  </div>
                </Option>
                <Option value="Culinary" label="Culinary">
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900 leading-tight">Culinary</span>
                    <span className="text-xs text-gray-500">Restaurants, cafés, food & dining</span>
                  </div>
                </Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="address"
              label="Address"
              rules={[{ required: true, message: 'Please enter the address' }]}
              className="mt-4"
            >
              <AutoComplete
                options={options}
                onSearch={handleSearch}
                onSelect={handleSelect}
                size="large"
                className="w-full"
                popupClassName="rounded-lg shadow-sm"
              >
                <Input
                  size="large"
                  placeholder={adCategory === 'Geo Campaign' ? "Search Area / Center Point" : "Exact Store Address"}
                  className="rounded-lg pr-12"
                  suffix={
                    <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => setIsMapModalVisible(true)}>
                      <EnvironmentOutlined className="text-[#00F0FF] text-lg" />
                      <span className="text-[10px] text-[#00F0FF] leading-none mt-0.5">Map</span>
                    </div>
                  }
                />
              </AutoComplete>
            </Form.Item>

            {adCategory === 'Geo Campaign' && (
              <Form.Item
                name="radius"
                className="mt-4"
                label="Campaign Radius (km)"
              >
                <div className="px-4">
                  <Slider
                    min={1}
                    max={50}
                    marks={{ 1: '1km', 5: '5km', 25: '25km', 50: '50km' }}
                  />
                </div>
              </Form.Item>
            )}

            <div className="flex items-center justify-between mt-8 mb-8">
              <span className="text-gray-800 text-base">Active</span>
              <Form.Item name="active" valuePropName="checked" noStyle>
                <Switch className="bg-gray-200" />
              </Form.Item>
            </div>

            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full h-12 bg-[#00F0FF] hover:bg-[#00d8e6] border-none rounded-lg text-gray-900 font-medium text-base shadow-sm"
              >
                {editData ? 'Save Changes' : 'Create Ad'}
              </Button>
            </Form.Item>

            <div className="text-center">
              <Button type="text" onClick={onClose} className="text-gray-600 font-medium">
                Cancel
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      <Modal
        title="Select Exact Location"
        open={isMapModalVisible}
        onCancel={() => setIsMapModalVisible(false)}
        onOk={handleConfirmMapLocation}
        width={600}
        okText="Confirm Location"
        centered
        zIndex={1050}
      >
        <div className="text-gray-500 mb-4 text-sm">Click on the map or drag the marker to select your exact location.</div>
        <div ref={mapRef} style={{ width: '100%', height: '400px', borderRadius: '8px' }}></div>
      </Modal>
    </>
  );
}

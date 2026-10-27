import React from 'react';
import { View, Image } from 'react-native';

const QRCodeWeb = ({ value = 'GYM_ATTENDANCE_CHECK_IN', size = 180, color = '#000', backgroundColor = '#FFF' }) => {
    const encodedValue = encodeURIComponent(value);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&bgcolor=${backgroundColor.replace('#', '')}&color=${color.replace('#', '')}`;
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor }}>
            <Image
                source={{ uri: qrUrl }}
                style={{ width: size, height: size }}
                resizeMode="contain"
            />
        </View>
    );
};

export default QRCodeWeb;

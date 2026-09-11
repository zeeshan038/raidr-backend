import React from 'react';
import { Outlet } from 'react-router-dom';

export default function EventsLayout() {
    return (
        <div className="events-layout">
            <Outlet />
        </div>
    );
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api/api';

export interface AppNotification {
  id: string;
  title: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  /** 06-C: mức độ (DANGER = quá hạn/leo thang, tô đỏ) và loại thông báo. */
  kind?: string;
  severity?: 'INFO' | 'WARNING' | 'DANGER';
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  digestEnabled: boolean;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/notifications`;

  /** 20 thông báo mới nhất; `unreadOnly` chỉ lấy chưa đọc (06-D4). */
  latest(unreadOnly = false): Observable<NotificationList> {
    return this.http.get<NotificationList>(this.url, {
      params: unreadOnly ? { unread: true } : {},
    });
  }

  markRead(id: string): Observable<AppNotification> {
    return this.http.post<AppNotification>(`${this.url}/${id}/read`, {});
  }

  preferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`${this.url}/preferences`);
  }

  setPreferences(prefs: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(`${this.url}/preferences`, prefs);
  }

  markAllRead(): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${this.url}/read-all`, {});
  }
}

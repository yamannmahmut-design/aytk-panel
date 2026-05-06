'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Kullanici = { id: string, kullanici_adi: string, ad_soyad: string, rol: string, kat: string }
type Urun = { id: string, kod: string, barkod: string, ad: string, kategori: string, stok: number, son_fiyat: number }
type Talep = { id: string, talep_barkod: string, adet: number, durum: string, urunler: Urun, kullanicilar: Kullanici, talep_tarihi: string }

export default function Home() {
  const [kullanici, setKullanici] = useState<Kullanici | null>(null)
  const [k_adi, setKadi] = useState('')
  const [sifre, setSifre] = useState('')
  const [urunler, setUrunler] = useState<Urun[]>([])
  const [talepler, setTalepler] = useState<Talep[]>([])
  const [seciliUrun, setSeciliUrun] = useState('')
  const [adet, setAdet] = useState(1)
  const [barkod, setBarkod] = useState('')

  const giris = async () => {
    const { data } = await supabase.from('kullanicilar').select('*').eq('kullanici_adi', k_adi).eq('sifre', sifre).single()
    if (data) {
      setKullanici(data)
      localStorage.setItem('kullanici', JSON.stringify(data))
    } else alert('Hatalı giriş')
  }

  const cikis = () => {
    setKullanici(null)
    localStorage.removeItem('kullanici')
  }

  const veriCek = async () => {
    const { data: u } = await supabase.from('urunler').select('*').order('ad')
    setUrunler(u || [])
    const { data: t } = await supabase.from('talepler').select(', urunler(), kullanicilar(*)').order('talep_tarihi', { ascending: false })
    setTalepler(t || [])
  }

  const talepOlustur = async () => {
    if (!seciliUrun || !kullanici) return
    const barkodNo = 'TLP' + Date.now()
    await supabase.from('talepler').insert({
      talep_barkod: barkodNo,
      urun_id: seciliUrun,
      talep_eden_id: kullanici.id,
      adet: adet
    })
    setAdet(1)
    veriCek()
  }

  const onay = async (id: string, durum: string) => {
    await supabase.from('talepler').update({ durum, onaylayan_id: kullanici?.id, onay_tarihi: new Date() }).eq('id', id)
    veriCek()
  }

  const barkodOkut = async () => {
    const { data: talep } = await supabase.from('talepler').select(', urunler()').eq('talep_barkod', barkod).single()
    if (talep && talep.durum === 'ONAYLANDI') {
      await supabase.from('talepler').update({ durum: 'TESLIM_EDILDI', teslim_tarihi: new Date() }).eq('id', talep.id)
      await supabase.from('stok_hareketleri').insert({
        urun_id: talep.urun_id,
        hareket_tipi: 'CIKIS',
        adet: talep.adet,
        talep_id: talep.id,
        islem_yapan_id: kullanici?.id
      })
      await supabase.from('barkod_log').insert({
        barkod: barkod,
        islem_tipi: 'STOK_CIKIS',
        urun_id: talep.urun_id,
        talep_id: talep.id,
        okutan_id: kullanici?.id
      })
      await supabase.from('urunler').update({ stok: talep.urunler.stok - talep.adet }).eq('id', talep.urun_id)
      setBarkod('')
      veriCek()
      alert('Teslim edildi: ' + talep.urunler.ad)
    } else alert('Barkod bulunamadı veya onaylanmamış')
  }

  useEffect(() => {
    const kayitli = localStorage.getItem('kullanici')
    if (kayitli) setKullanici(JSON.parse(kayitli))
    veriCek()
  }, [])

  if (!kullanici) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">AYTK Takip Sistemi</h1>
          <input className="border p-2 w-full mb-3 rounded" placeholder="Kullanıcı Adı" value={k_adi} onChange={e => setKadi(e.target.value)} />
          <input className="border p-2 w-full mb-4 rounded" type="password" placeholder="Şifre" value={sifre} onChange={e => setSifre(e.target.value)} />
          <button className="bg-blue-600 text-white p-2 w-full rounded" onClick={giris}>Giriş Yap</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white p-4 rounded-lg shadow mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">AYTK Takip</h1>
            <p className="text-sm text-gray-600">{kullanici.ad_soyad} - {kullanici.rol} {kullanici.kat && - ${kullanici.kat}}</p>
          </div>
          <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={cikis}>Çıkış</button>
        </div>

        {kullanici.rol === 'PERSONEL' && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h2 className="font-bold mb-3">Malzeme Talep Et - {kullanici.kat}</h2>
            <div className="flex gap-2">
              <select className="border p-2 rounded flex-1" value={seciliUrun} onChange={e => setSeciliUrun(e.target.value)}>
                <option value="">Ürün Seç</option>
                {urunler.filter(u => u.kategori === 'Temizlik').map(u => 
                  <option key={u.id} value={u.id}>{u.ad} - Stok: {u.stok}</option>
                )}
              </select>
              <input className="border p-2 rounded w-24" type="number" min="1" value={adet} onChange={e => setAdet(Number(e.target.value))} />
              <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={talepOlustur}>Talep Et</button>
            </div>
          </div>
        )}

        {kullanici.rol === 'MUDUR' && (
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h2 className="font-bold mb-3">Barkod Okut - Teslim Et</h2>
            <div className="flex gap-2">
              <input className="border p-2 rounded flex-1" placeholder="TLP..." value={barkod} onChange={e => setBarkod(e.target.value)} />
              <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={barkodOkut}>Teslim Et</button>
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-bold mb-3">Talepler</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Tarih</th>
                <th className="text-left p-2">Talep Eden</th>
                <th className="text-left p-2">Kat</th>
                <th className="text-left p-2">Ürün</th>
                <th className="text-left p-2">Adet</th>
                <th className="text-left p-2">Barkod</th>
                <th className="text-left p-2">Durum</th>
                {kullanici.rol === 'MUDUR' && <th className="text-left p-2">İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {talepler.filter(t => kullanici.rol === 'MUDUR' || t.kullanicilar.id === kullanici.id).map(t => (
                <tr key={t.id} className="border-b">
                  <td className="p-2">{new Date(t.talep_tarihi).toLocaleDateString('tr')}</td>
                  <td className="p-2">{t.kullanicilar.ad_soyad}</td>
                  <td className="p-2">{t.kullanicilar.kat || '-'}</td>
                  <td className="p-2">{t.urunler.ad}</td>
                  <td className="p-2">{t.adet}</td>
                  <td className="p-2 font-mono text-xs">{t.talep_barkod}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      t.durum === 'BEKLEMEDE' ? 'bg-yellow-200' : 
                      t.durum === 'ONAYLANDI' ? 'bg-blue-200' :
                      t.durum === 'TESLIM_EDILDI' ? 'bg-green-200' : 'bg-red-200'
                    }`}>{t.durum}</span>
                  </td>
                  {kullanici.rol === 'MUDUR' && t.durum === 'BEKLEMEDE' && (
                    <td className="p-2">
                      <button className="bg-green-500 text-white px-2 py-1 rounded text-xs mr-1" onClick={() => onay(t.id, 'ONAYLANDI')}>Onayla</button>
                      <button className="bg-red-500 text-white px-2 py-1 rounded text-xs" onClick={() => onay(t.id, 'REDDEDILDI')}>Reddet</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

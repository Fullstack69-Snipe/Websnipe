import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { useFeedback } from '../lib/useFeedback'
import type { Department, Equipment, User } from '../types'
import DepartmentEquipment from '../components/DepartmentEquipment'

// แผนก — admin เท่านั้น
// staff จัดการได้เฉพาะอุปกรณ์ในแผนกที่ตัวเองดูแล และอุปกรณ์ที่ไม่สังกัดแผนก
export default function ManageDepartments() {
  const { toast, confirm, prompt } = useFeedback()
  const [departments, setDepartments] = useState<Department[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [staff, setStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  // แผนกที่เปิดหน้าต่างจัดการอยู่ (เก็บ id เพราะข้อมูลแผนกโหลดใหม่หลังแก้ทุกครั้ง)
  const [openId, setOpenId] = useState<number | null>(null)
  const [staffToAdd, setStaffToAdd] = useState('')

  const load = () =>
    Promise.all([api.listDepartments(), api.listEquipment(), api.listUsers()])
      .then(([deps, eq, users]) => {
        setDepartments(deps)
        setEquipment(eq)
        setStaff(users.filter((u) => u.role === 'staff'))
      })
      .catch(() => setError('โหลดข้อมูลแผนกไม่สำเร็จ'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  // รวม logic เรียก api -> แจ้งผล -> โหลดใหม่ ของทุกปุ่มไว้ที่เดียว
  async function run(fn: () => Promise<unknown>, successMsg: string) {
    try {
      await fn()
      toast(successMsg)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError('')
    try {
      await api.createDepartment(name.trim())
      toast(`เพิ่มแผนก "${name.trim()}" แล้ว`)
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveStaff(dep: Department, s: Department['staff'][number]) {
    const ok = await confirm({
      title: 'เอาเจ้าหน้าที่ออก',
      message: `เอา ${s.fullName} ออกจาก "${dep.name}"? จะจัดการอุปกรณ์ของแผนกนี้ไม่ได้อีก`,
      confirmLabel: 'เอาออก',
      danger: true,
    })
    if (!ok) return
    await run(
      () => api.removeStaffFromDepartment(dep.id, s.id),
      `เอา ${s.fullName} ออกจากแผนกแล้ว`,
    )
  }

  async function handleRename(dep: Department) {
    const name = await prompt({
      title: 'แก้ชื่อแผนก',
      message: `ชื่อเดิม: ${dep.name}`,
      label: 'ชื่อใหม่',
      initialValue: dep.name,
      confirmLabel: 'บันทึก',
    })
    if (name === null || !name.trim() || name.trim() === dep.name) return
    await run(() => api.renameDepartment(dep.id, name.trim()), `เปลี่ยนชื่อเป็น "${name.trim()}" แล้ว`)
  }

  async function handleDelete(dep: Department) {
    const ok = await confirm({
      title: 'ลบแผนก',
      message:
        dep.equipmentCount > 0
          ? `ลบ "${dep.name}"? อุปกรณ์ ${dep.equipmentCount} ชิ้นจะกลายเป็นไม่สังกัดแผนก (ไม่ถูกลบ) และเจ้าหน้าที่ทุกคนจัดการได้`
          : `ลบ "${dep.name}"?`,
      confirmLabel: 'ลบ',
      danger: true,
    })
    if (!ok) return
    if (openId === dep.id) setOpenId(null)
    await run(() => api.deleteDepartment(dep.id), `ลบแผนก "${dep.name}" แล้ว`)
  }

  if (loading) return <p aria-busy="true">กำลังโหลด...</p>

  const open = departments.find((d) => d.id === openId) ?? null
  const staffNotIn = staff.filter((u) => open && !open.staff.some((s) => s.id === u.id))

  return (
    <section>
      <hgroup>
        <h1>แผนก</h1>
        <p>กำหนดว่าเจ้าหน้าที่คนไหนดูแลอุปกรณ์ชิ้นไหน — อุปกรณ์ที่ไม่สังกัดแผนก เจ้าหน้าที่ทุกคนจัดการได้</p>
      </hgroup>

      {error && <p className="error" role="alert">{error}</p>}

      <form onSubmit={handleCreate} className="category-form">
        <label>
          ชื่อแผนก
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คณะวิศวกรรมศาสตร์"
            maxLength={120}
            required
          />
        </label>
        <div className="actions">
          <button type="submit" aria-busy={saving}>
            <Plus aria-hidden="true" />
            เพิ่มแผนก
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-name">ชื่อ</th>
              <th>เจ้าหน้าที่ที่ดูแล</th>
              <th className="col-num">อุปกรณ์</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 && (
              <tr>
                <td colSpan={4}>ยังไม่มีแผนก</td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.id}>
                <td className="col-name"><strong>{d.name}</strong></td>
                <td className="muted">
                  {d.staff.length === 0 ? '—' : d.staff.map((s) => s.fullName).join(', ')}
                </td>
                <td className="col-num">{d.equipmentCount}</td>
                <td className="col-actions">
                  <div className="actions">
                    <button type="button" className="outline" onClick={() => setOpenId(d.id)}>
                      จัดการ
                    </button>
                    <button type="button" className="outline" onClick={() => void handleRename(d)}>
                      แก้ชื่อ
                    </button>
                    <Link to={`/manage/qr?department=${d.id}`} role="button" className="outline">
                      พิมพ์ QR
                    </Link>
                    <button
                      type="button"
                      className="outline secondary"
                      onClick={() => void handleDelete(d)}
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog open={open !== null} className="department-dialog">
        {open && (
          <article>
            <header>
              <strong>{open.name}</strong>
            </header>

            <h2>เจ้าหน้าที่ ({open.staff.length})</h2>
            {open.staff.length === 0 ? (
              <p className="muted">ยังไม่มีเจ้าหน้าที่ดูแล</p>
            ) : (
              <ul className="pick-list">
                {open.staff.map((s) => (
                  <li key={s.id}>
                    <span>
                      {s.fullName} <small className="muted">{s.email}</small>
                    </span>
                    <button
                      type="button"
                      className="outline secondary"
                      aria-label={`เอา ${s.fullName} ออก`}
                      onClick={() => void handleRemoveStaff(open, s)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="assign-row">
              <select
                value={staffToAdd}
                aria-label="เลือกเจ้าหน้าที่"
                onChange={(e) => setStaffToAdd(e.target.value)}
              >
                <option value="">เลือกเจ้าหน้าที่…</option>
                {staffNotIn.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!staffToAdd}
                onClick={() => {
                  const id = staffToAdd
                  setStaffToAdd('')
                  void run(() => api.assignStaffToDepartment(open.id, id), 'เพิ่มเจ้าหน้าที่แล้ว')
                }}
              >
                เพิ่ม
              </button>
            </div>

            <h2>อุปกรณ์</h2>
            <DepartmentEquipment
              department={open}
              equipment={equipment}
              // shortcut: ยิงทีละชิ้นพร้อมกัน — ถ้าต้องย้ายทีละหลายร้อยชิ้นค่อยทำ endpoint แบบ bulk
              onAssign={(ids) =>
                run(
                  () => Promise.all(ids.map((id) => api.assignEquipmentToDepartment(open.id, id))),
                  `เพิ่ม ${ids.length} ชิ้นเข้าแผนก "${open.name}" แล้ว`,
                )
              }
              onUnassign={(e) =>
                void run(
                  () => api.unassignEquipmentFromDepartment(open.id, e.id),
                  `เอา "${e.name}" ออกจากแผนกแล้ว`,
                )
              }
            />

            <footer>
              <button type="button" className="secondary" onClick={() => setOpenId(null)}>
                ปิด
              </button>
            </footer>
          </article>
        )}
      </dialog>
    </section>
  )
}

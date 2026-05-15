import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useNotifications } from 'hooks';
import { getServerError } from 'libs';
import { useCreateGpuRequestMutation } from 'services/gpuRequest';

import { usePortalContext } from './components';
import { PORTAL_ROUTES } from './constants';
import { buildGpuRequestCreateParams } from './utils';

import styles from './styles.module.scss';

const initialValues: IGpuRequestFormValues = {
    project_name: '',
    name: '',
    image: '',
    commands: '',
    env: '',
    ports: '',
    nodes: '1',
    cpu: '',
    memory: '',
    gpu: '',
    disk: '',
    max_duration: '',
    fleets: '',
};

export const PortalGpuRequestCreate: React.FC = () => {
    const navigate = useNavigate();
    const [pushNotification] = useNotifications();
    const { projects, selectedProjectName, setSelectedProjectName } = usePortalContext();
    const [values, setValues] = useState<IGpuRequestFormValues>({ ...initialValues, project_name: selectedProjectName });
    const [error, setError] = useState('');
    const [createGpuRequest, { isLoading }] = useCreateGpuRequestMutation();

    useEffect(() => {
        if (!values.project_name && selectedProjectName) {
            setValues((currentValues) => ({ ...currentValues, project_name: selectedProjectName }));
        }
    }, [selectedProjectName, values.project_name]);

    const setField = (field: keyof IGpuRequestFormValues) => {
        return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const nextValue = event.target.value;
            setValues((currentValues) => ({ ...currentValues, [field]: nextValue }));
            if (field === 'project_name') {
                setSelectedProjectName(nextValue);
            }
        };
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (!values.project_name) {
            setError('请选择项目');
            return;
        }
        if (!values.image.trim()) {
            setError('请填写容器镜像');
            return;
        }
        if (!values.commands.trim()) {
            setError('请填写启动命令');
            return;
        }

        createGpuRequest(buildGpuRequestCreateParams(values))
            .unwrap()
            .then((request) => {
                pushNotification({
                    type: 'success' as const,
                    content: 'GPU 申请已提交',
                });
                navigate(PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(request.project_name, request.id));
            })
            .catch((requestError) => {
                setError(getServerError(requestError));
            });
    };

    return (
        <form className={styles.contentNarrow} onSubmit={submit}>
            <div className={styles.toolbar}>
                <div>
                    <h2 className={styles.panelTitle}>新建 GPU 申请</h2>
                    <div className={styles.muted}>容器镜像、启动命令与资源规格</div>
                </div>
                <div className={styles.topbarActions}>
                    <Link className={styles.button} to={PORTAL_ROUTES.GPU_REQUESTS}>
                        取消
                    </Link>
                    <button className={styles.buttonPrimary} type="submit" disabled={isLoading}>
                        {isLoading ? '提交中...' : '提交申请'}
                    </button>
                </div>
            </div>

            {error && <div className={styles.alert}>{error}</div>}

            <section className={styles.panel} style={{ marginTop: 16 }}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>基础信息</h3>
                </div>
                <div className={styles.panelBody}>
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label htmlFor="project_name">项目</label>
                            <select
                                id="project_name"
                                className={styles.select}
                                value={values.project_name}
                                onChange={setField('project_name')}
                            >
                                <option value="">请选择项目</option>
                                {projects.map((project) => (
                                    <option key={project.project_name} value={project.project_name}>
                                        {project.project_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="name">申请名称</label>
                            <input
                                id="name"
                                className={styles.input}
                                value={values.name}
                                onChange={setField('name')}
                                placeholder="train-qwen"
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="image">容器镜像</label>
                            <input
                                id="image"
                                className={styles.input}
                                value={values.image}
                                onChange={setField('image')}
                                placeholder="pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime"
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="nodes">节点数</label>
                            <input
                                id="nodes"
                                className={styles.input}
                                min="1"
                                type="number"
                                value={values.nodes}
                                onChange={setField('nodes')}
                            />
                        </div>

                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label htmlFor="commands">启动命令</label>
                            <textarea
                                id="commands"
                                className={styles.textarea}
                                value={values.commands}
                                onChange={setField('commands')}
                                placeholder="python train.py"
                            />
                        </div>

                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label htmlFor="env">环境变量</label>
                            <textarea
                                id="env"
                                className={styles.textarea}
                                value={values.env}
                                onChange={setField('env')}
                                placeholder="MODEL=qwen"
                            />
                            <div className={styles.helperText}>每行一个 KEY=VALUE。</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.panel} style={{ marginTop: 16 }}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>资源规格</h3>
                </div>
                <div className={styles.panelBody}>
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label htmlFor="gpu">GPU</label>
                            <input
                                id="gpu"
                                className={styles.input}
                                value={values.gpu}
                                onChange={setField('gpu')}
                                placeholder="1"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="cpu">CPU</label>
                            <input
                                id="cpu"
                                className={styles.input}
                                value={values.cpu}
                                onChange={setField('cpu')}
                                placeholder="8"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="memory">内存</label>
                            <input
                                id="memory"
                                className={styles.input}
                                value={values.memory}
                                onChange={setField('memory')}
                                placeholder="32GB"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="disk">磁盘</label>
                            <input
                                id="disk"
                                className={styles.input}
                                value={values.disk}
                                onChange={setField('disk')}
                                placeholder="200GB"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="ports">端口</label>
                            <input
                                id="ports"
                                className={styles.input}
                                value={values.ports}
                                onChange={setField('ports')}
                                placeholder="8888,6006"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="max_duration">最长运行时间</label>
                            <input
                                id="max_duration"
                                className={styles.input}
                                value={values.max_duration}
                                onChange={setField('max_duration')}
                                placeholder="4h"
                            />
                        </div>
                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label htmlFor="fleets">指定服务器/Fleet</label>
                            <input
                                id="fleets"
                                className={styles.input}
                                value={values.fleets}
                                onChange={setField('fleets')}
                                placeholder="gpu-a,gpu-b"
                            />
                        </div>
                    </div>
                </div>
            </section>
        </form>
    );
};

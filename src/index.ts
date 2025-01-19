import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

// 添加API域名白名单
basekit.addDomainList(['beiancx.com']);

basekit.addField({
	// 定义国际化语言资源
	i18n: {
		messages: {
			'zh-CN': {
				'domain': '域名',
				'recordNo': '备案号',
				'company': '主办单位',
				'websiteName': '网站名称',
				'recordTime': '备案时间'
			},
			'en-US': {
				'domain': 'Domain',
				'recordNo': 'Record Number',
				'company': 'Company',
				'websiteName': 'Website Name',
				'recordTime': 'Record Time'
			}
		}
	},

	// 定义输入表单
	formItems: [
		{
			key: 'domain',
			label: t('domain'),
			component: FieldComponent.FieldSelect,
			props: {
				supportType: [FieldType.Text],
				// 将dependID移动到props中
				dependID: (params) => params.dependID || 'defaultDependID'
			},
			validator: {
				required: true
			}
		}
	],

	// 定义结果展示
	resultType: {
		type: FieldType.Object,
		extra: {
			icon: {
				light: 'https://img.icons8.com/ios/50/000000/domain.png',
				dark: 'https://img.icons8.com/ios-filled/50/ffffff/domain.png'
			},
			properties: [
				{
					key: 'domain',
					title: t('domain'),
					type: FieldType.Text,
					isGroupByKey: true,
					primary: true
				},
				{
					key: 'recordNo',
					title: t('recordNo'),
					type: FieldType.Text
				},
				{
					key: 'company',
					title: t('company'),
					type: FieldType.Text
				},
				{
					key: 'websiteName',
					title: t('websiteName'),
					type: FieldType.Text
				},
				{
					key: 'recordTime',
					title: t('recordTime'),
					type: FieldType.Text
				}
			]
		}
	},

	// 执行逻辑
	execute: async (formItemParams, context) => {
		console.log('Received formItemParams:', JSON.stringify(formItemParams, null, 2));

		// 正确解析domain参数
		const domain = Array.isArray(formItemParams.domain) && formItemParams.domain.length > 0
			? formItemParams.domain[0].text
			: '';

		// 确保domain是字符串类型
		const queryDomain = typeof domain === 'string' ? domain.trim() : '';
		const dependID = formItemParams.dependID?.value || 'defaultDependID';

		try {
			const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
			if (!domainPattern.test(queryDomain)) {
				console.error('Invalid queryDomain:', queryDomain);
				return {
					code: FieldCode.InvalidArgument,
					data: {
						id: dependID,
						primaryProperty: domain,
						domain: queryDomain,
						recordNo: '',
						company: '',
						websiteName: '',
						recordTime: ''
					},
					msg: '===捷径代码主动返回错误: 请输入有效的域名'
				};
			}

			// 定义API接口列表
			const apiEndpoints = [
				`https://beiancx.com/icp.php?url=${encodeURIComponent(queryDomain)}`,
				`https://beiancx.com/icp2.php?url=${encodeURIComponent(queryDomain)}`
			];

			let lastError;
			// 重试机制
			for (let i = 0; i < apiEndpoints.length; i++) {
				try {
					const apiUrl = apiEndpoints[i];
					console.log(`Making API request to (attempt ${i + 1}):`, apiUrl);

					const response = await context.fetch(apiUrl, {
						method: 'GET',
						headers: {
							'Content-Type': 'application/json'
						},
						timeout: 5000 // 设置5秒超时
					});

					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}

					const result = await response.json();
					console.log('API response:', JSON.stringify(result, null, 2));

					if (!result || result.status !== 200 || !result.data) {
						throw new Error('Invalid API response');
					}

					// 确保所有字段都有值
					const responseData = {
						id: dependID,
						primaryProperty: result.data.icp_domain || queryDomain,
						domain: result.data.icp_domain || queryDomain,
						recordNo: result.data.icp_numer || '无',
						company: result.data.icp_subject || '未知',
						websiteName: result.data.icp_type || '无',
						recordTime: result.data.review_date || '未知'
					};

					// 验证返回数据结构
					const requiredFields = ['domain', 'recordNo', 'company', 'websiteName', 'recordTime'];
					for (const field of requiredFields) {
						if (typeof responseData[field] !== 'string') {
							responseData[field] = '无';
						}
					}

					return {
						code: FieldCode.Success,
						data: responseData,
						msg: ''
					};

				} catch (error) {
					console.error(`API request failed (attempt ${i + 1}):`, error);
					lastError = error;
					if (i < apiEndpoints.length - 1) {
						console.log('Retrying with next endpoint...');
					}
				}
			}

			// 所有尝试都失败
			console.error('All API requests failed');
			return {
				code: FieldCode.Error,
				data: null,
				msg: `===捷径代码主动返回错误: ${lastError?.message || '所有接口请求失败'}`
			};

		} catch (error) {
			console.error('Execute Error:', error);
			return {
				code: FieldCode.Error,
				data: null,
				msg: `===捷径代码主动返回错误: ${error.message || '系统异常，请稍后重试'}`
			};
		}
	}
});

export default basekit;